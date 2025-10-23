import { ethers } from "hardhat";

/**
 * Script de interação: exemplos de chamadas comuns
 * Executar: npx hardhat run scripts/interact.ts --network hardhat
 */
async function main() {
    const [caller] = await ethers.getSigners();
    console.log("Caller:", caller.address);

    // Substitua pelos endereços após deploy
    const rewardAddress = process.env.REWARD_ADDRESS || "";
    const tokenAAddress = process.env.TOKENA_ADDRESS || "";
    const tokenBAddress = process.env.TOKENB_ADDRESS || "";

    if (!rewardAddress || !tokenAAddress || !tokenBAddress) {
        console.log("Defina REWARD_ADDRESS, TOKENA_ADDRESS, TOKENB_ADDRESS no .env para usar este script.");
        return;
    }

    const reward = await ethers.getContractAt("RewardDistributor", rewardAddress);
    const tokenA = await ethers.getContractAt("TokenA", tokenAAddress);
    const tokenB = await ethers.getContractAt("TokenB", tokenBAddress);

    console.log("Percent BPS:", await reward.rewardPercentBps());
    console.log("Pode disparar?", await reward.canTrigger());
    console.log("Próximo bloco alvo:", await reward.nextTriggerBlock());

    try {
        const txAdd = await reward.addParticipant(caller.address);
        await txAdd.wait();
        console.log("Participante adicionado:", caller.address);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("Falha ao adicionar participante (talvez já exista):", msg);
    }

    try {
        const txTrig = await reward.manualTrigger();
        await txTrig.wait();
        console.log("Distribuição manual executada.");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("Erro trigger manual:", msg);
    }

    const balA = await tokenA.balanceOf(caller.address);
    const balB = await tokenB.balanceOf(caller.address);
    console.log("Saldo TokenA caller:", ethers.formatEther(balA));
    console.log("Saldo TokenB caller:", ethers.formatEther(balB));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});