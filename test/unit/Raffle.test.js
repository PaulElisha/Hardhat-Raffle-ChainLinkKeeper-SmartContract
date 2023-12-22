const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, network, ethers } = require("hardhat");
const { assert } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", async () => {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee
        const chainId = network.config.chainId;

        beforeEach(async () => {
            const { deployer } = await getNamedAccounts();
            await deployments.fixture(["all"]);
            raffle = await ethers.deployContract("Raffle");
            vrfCoordinatorV2Mock = await ethers.deployContract("vrfCoordinatorV2Mock");
            raffleEntranceFee = await raffle.getEntranceFee();
        });

        describe("deployment", async () => {
            it("initializes the raffle", async () => {
                const raffleState = await raffle.getRaffleState();
                const interval = raffle.getInterval();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            })
        });

        describe("Enter Raffle", async () => {
            it("reverts when you don't pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__InsufficientEthPassed"
                );
            });
            it("records players when they enter", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const player = await raffle.getPlayer(0);
                assert.equal(player, deployer);
            })
        })
    })