import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenA__factory, TokenB__factory, RewardDistributor__factory } from "../typechain-types";
import type { TokenA, TokenB, RewardDistributor } from "../typechain-types";

describe("RewardDistributor Edge Cases", () => {
    let deployer: HardhatEthersSigner;
    let tokenA: TokenA, tokenB: TokenB, reward: RewardDistributor;

    beforeEach(async () => {
        [deployer] = await ethers.getSigners();
        tokenA = await new TokenA__factory(deployer).deploy(ethers.parseEther("100000"));
        await tokenA.waitForDeployment();
        tokenB = await new TokenB__factory(deployer).deploy();
        await tokenB.waitForDeployment();
        reward = await new RewardDistributor__factory(deployer).deploy(await tokenA.getAddress(), await tokenB.getAddress(), 5000, 10);
        await reward.waitForDeployment();
        await (await tokenB.transferOwnership(await reward.getAddress())).wait();
    });

    it("reverte ao definir percentual > 10000", async () => {
        await expect(reward.setRewardPercentBps(10001)).to.be.revertedWith(">100%"
        );
    });

    it("permite reconfigurar tokens via setTokens", async () => {
        const tokenANew = await new TokenA__factory(deployer).deploy(ethers.parseEther("50000"));
        await tokenANew.waitForDeployment();
        const tokenBNew = await new TokenB__factory(deployer).deploy();
        await tokenBNew.waitForDeployment();

        await expect(reward.setTokens(await tokenANew.getAddress(), await tokenBNew.getAddress()))
            .to.emit(reward, "TokensConfigured")
            .withArgs(await tokenANew.getAddress(), await tokenBNew.getAddress());
    });
});
