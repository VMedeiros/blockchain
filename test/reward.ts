import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenA__factory, TokenB__factory, RewardDistributor__factory } from "../typechain-types";
import type { TokenA, TokenB, RewardDistributor } from "../typechain-types";

describe("RewardDistributor", () => {
    let deployer: HardhatEthersSigner, user1: HardhatEthersSigner, user2: HardhatEthersSigner;
    let tokenA: TokenA, tokenB: TokenB, reward: RewardDistributor;

    beforeEach(async () => {
        [deployer, user1, user2] = await ethers.getSigners();

        tokenA = await new TokenA__factory(deployer).deploy(ethers.parseEther("1000000"));
        await tokenA.waitForDeployment();

        tokenB = await new TokenB__factory(deployer).deploy();
        await tokenB.waitForDeployment();

        reward = await new RewardDistributor__factory(deployer).deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            5000,
            5
        );
        await reward.waitForDeployment();

        // Transferir ownership de TokenB para RewardDistributor (para mint)
        await (await tokenB.transferOwnership(await reward.getAddress())).wait();

        // participantes
        await (await reward.addParticipant(user1.address)).wait();
        await (await reward.addParticipant(user2.address)).wait();

        // distribuir TokenA
        await (await tokenA.transfer(user1.address, ethers.parseEther("100"))).wait();
        await (await tokenA.transfer(user2.address, ethers.parseEther("60"))).wait();
    });

    it("faz mint manual proporcional", async () => {
        await (await reward.manualTrigger()).wait();
        const balB1 = await tokenB.balanceOf(user1.address);
        const balB2 = await tokenB.balanceOf(user2.address);
        expect(balB1).to.equal(ethers.parseEther("50"));
        expect(balB2).to.equal(ethers.parseEther("30"));
    });

    it("não permite distribuir sem avanço de bloco (simulação manual)", async () => {
        await (await reward.manualTrigger()).wait();
        // Chamada estática deve reverter pois não houve avanço de bloco --->
        await expect(reward.manualTrigger.staticCall()).to.be.revertedWith("Already distributed this block");
        // Avança bloco via transação simples
        await tokenA.transfer(deployer.address, 1);
        // Agora execução deve funcionar
        await (await reward.manualTrigger()).wait();
    });

    it("não dispara triggerIfInterval antes do tempo", async () => {
        // Deploy nova dupla TokenB + Reward independente para não reutilizar ownership anterior
        const tokenBNew = await new TokenB__factory(deployer).deploy();
        await tokenBNew.waitForDeployment();
        const fresh = await new RewardDistributor__factory(deployer).deploy(
            await tokenA.getAddress(), // usa mesmo tokenA para simplificar
            await tokenBNew.getAddress(),
            5000,
            5
        );
        await fresh.waitForDeployment();
        await (await tokenBNew.transferOwnership(await fresh.getAddress())).wait();
        expect(await fresh.canTrigger()).to.equal(false);
        await expect(fresh.triggerIfInterval()).to.be.revertedWith("Interval not reached");
    });

    it("dispara após intervalo avançando blocos", async () => {
        for (let i = 0; i < 6; i++) {
            await tokenA.transfer(deployer.address, 1);
        }
        await (await reward.autoTrigger()).wait();
        expect(await tokenB.balanceOf(user1.address)).to.equal(
            ethers.parseEther("50")
        );
    });

    it("pause TokenB impede mint", async () => {
        // Deploy novo TokenB e Reward
        const tokenBTemp = await new TokenB__factory(deployer).deploy();
        await tokenBTemp.waitForDeployment();
        // Pausa TokenB antes de transferir ownership
        await (await tokenBTemp.pause()).wait();
        const rewardTemp = await new RewardDistributor__factory(deployer).deploy(
            await tokenA.getAddress(),
            await tokenBTemp.getAddress(),
            5000,
            5
        );
        await rewardTemp.waitForDeployment();
        await (await tokenBTemp.transferOwnership(await rewardTemp.getAddress())).wait();
        // Adiciona participante para testar
        await (await rewardTemp.addParticipant(user1.address)).wait();
        await expect(rewardTemp.manualTrigger()).to.be.reverted;
    });

    it("apenas operador adiciona participante", async () => {
        await expect(
            reward.connect(user1).addParticipant(deployer.address)
        ).to.be.reverted;
    });

    it("previewUserReward mostra saldo e recompensa proporcional", async () => {
        // user1 tem 100 TokenA e percent é 50% => recompensa prevista 50 TokenB
        const [balanceA, rewardAmount] = await reward.previewUserReward(user1.address);
        expect(balanceA).to.equal(ethers.parseEther("100"));
        expect(rewardAmount).to.equal(ethers.parseEther("50"));
    });

    it("previewAllRewards retorna arrays alinhados", async () => {
        const result = await reward.previewAllRewards();
        const accounts: string[] = result[0];
        const rewards: bigint[] = result[1];
        expect(accounts.length).to.equal(2);
        expect(rewards.length).to.equal(2);
        // user1 ~ 50, user2 ~ 30
        // Ordenação deve corresponder à ordem interna do EnumerableSet (inserção)
        const idxUser1 = accounts.indexOf(user1.address);
        const idxUser2 = accounts.indexOf(user2.address);
        expect(rewards[idxUser1]).to.equal(ethers.parseEther("50"));
        expect(rewards[idxUser2]).to.equal(ethers.parseEther("30"));
    });
});
