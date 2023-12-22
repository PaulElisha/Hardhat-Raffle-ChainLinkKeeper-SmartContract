// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Custom Errors */
    error Raffle__InsufficientEthPassed();
    error Raffle__TransferFailed(); 
    error Raffle__NotOpen();
    error Raffle__UpkeepNotNeeded(uint256 balance, uint256 players, uint256 rafflestate);

    /* Events Declarations */
    event RaffleEntered(address indexed player);
    event RequestedRandomWinner(uint256 requestId);
    event Winner(address indexed winner);




    /* Type Declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callBackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    address payable s_Winner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;


    /* Functions */
    constructor(
        address vrfCoordinator, 
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinator) 
    {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_entranceFee = entranceFee;
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callBackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState(0);
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if(msg.value < i_entranceFee) revert Raffle__InsufficientEthPassed();
        if(s_raffleState != RaffleState.OPEN) revert Raffle__NotOpen();
        s_players.push(payable(msg.sender));
        emit RaffleEntered(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData*/
    ) public view override returns(bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasBalance && hasPlayers); 

    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if(!upkeepNeeded) revert Raffle__UpkeepNotNeeded(
            address(this).balance, s_players.length, uint256(s_raffleState)
        );

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callBackGasLimit,
            NUM_WORDS
        );
        emit RequestedRandomWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexWinner = randomWords[0] % s_players.length;
        address payable winner = s_players[indexWinner];
        s_Winner = winner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = s_Winner.call{value: address(this).balance}("");
        if(!success) revert Raffle__TransferFailed();
        emit Winner(s_Winner);
    }

    function getEntrancefee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getWinner() public view returns (address) {
        return s_Winner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfplayers() public view returns (uint256) {
        return s_players.length;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }
}