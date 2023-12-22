const { getNamedAccounts, deployments, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const SUB_AMOUNT = ethers.parseEther("10");

const deployRaffle = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.deployContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target;
        const txResponse = await vrfCoordinatorV2Mock.createSubscription();
        const txReceipt = await txResponse.wait(1);
        subscriptionId = txReceipt.events[0].args.subId;

        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, SUB_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
    const callbackGasLimit = networkConfig[chainId]["callBackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval
    ]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations
    });

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying!");
        await verify(raffle.address, args);
    }
    log(".........................................................");
}

module.exports = ["all", "raffle"];
module.exports.default = deployRaffle;