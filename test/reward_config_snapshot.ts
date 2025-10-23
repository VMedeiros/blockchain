import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenA__factory, TokenB__factory, RewardDistributor__factory } from "../typechain-types";
import type { TokenA, TokenB, RewardDistributor } from "../typechain-types";

describe("RewardDistributor Config", () => {
    let deployer: HardhatEthersSigner, user1: HardhatEthersSigner, user2: HardhatEthersSigner;
    let tokenA: TokenA, tokenB: TokenB, reward: RewardDistributor;

    beforeEach(async () => {
        [deployer, user1, user2] = await ethers.getSigners();
        tokenA = await new TokenA__factory(deployer).deploy(ethers.parseEther("1000000"));
        await tokenA.waitForDeployment();
        tokenB = await new TokenB__factory(deployer).deploy();
        await tokenB.waitForDeployment();
        reward = await new RewardDistributor__factory(deployer).deploy(await tokenA.getAddress(), await tokenB.getAddress(), 5000, 5);
        await reward.waitForDeployment();
        await (await tokenB.transferOwnership(await reward.getAddress())).wait();
        await (await reward.addParticipant(user1.address)).wait();
        await (await reward.addParticipant(user2.address)).wait();
        await (await tokenA.transfer(user1.address, ethers.parseEther("100"))).wait();
        await (await tokenA.transfer(user2.address, ethers.parseEther("60"))).wait();
    });

    it("atualiza percent e intervalo", async () => {
        await (await reward.setRewardPercentBps(4000)).wait();
        expect(await reward.rewardPercentBps()).to.equal(4000);
        await (await reward.setBlockInterval(10)).wait();
        expect(await reward.blockInterval()).to.equal(10);
    });

    it("setMaxParticipants não permite reduzir abaixo do atual", async () => {
        await expect(reward.setMaxParticipants(1)).to.be.revertedWith("Below current count");
        await (await reward.setMaxParticipants(2000)).wait();
        expect(await reward.maxParticipants()).to.equal(2000);
    });

});