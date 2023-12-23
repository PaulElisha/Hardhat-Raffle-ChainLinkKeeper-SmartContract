const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, network, ethers } = require("hardhat");
const { assert } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", () => {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval
        const chainId = network.config.chainId;

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["all"]);
            raffle = await ethers.deployContract("Raffle");
            vrfCoordinatorV2Mock = await ethers.deployContract("vrfCoordinatorV2Mock");
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        });

        describe("deployment", () => {
            it("initializes the raffle", async () => {
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            })
        });

        describe("Enter Raffle", () => {
            it("reverts when you don't pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__InsufficientEthPassed"
                );
            });
            it("records players when they enter", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const player = await raffle.getPlayer(0);
                assert.equal(player, deployer);
            });
            it("emits an event", async () => {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                    Raffle, "RaffleEntered"
                )
            });
            it("doesn't allow entrance when Raffle is calculating", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep([]);
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                    "Raffle__NotOpen"
                )
            });
        });
        describe("checkUpkeep", () => {
            it("returns false if no ETH is sent", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", []);
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded);
            });
            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep("0x") // another way to send a blank bytes ([])
                const raffleState = await raffle.getRaffleState();
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1");
                assert.equal(upkeepNeeded, false)
            });
            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", []);
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(!upkeepNeeded);
            });
            it("returns false if enough time has passed, has players, ETH, is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                await network.provider.request({ method: "evm_mine", params: [] });
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(upkeepNeeded);
            })
        });
        describe("performUpkeep", () => {
            it("can only run if checkupkeep returns true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] });
                const tx = await raffle.performUpkeep([])
                assert(tx);
            })
            it("reverts if checkupkeep returns false", async () => {
                await expect(raffle.performUpkeep([])).to.be.revertedWith(
                    "Raffle__UpkeepNotNeeded"
                )
            });
        })
    })