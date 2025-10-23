import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const rewardAddress = process.env.REWARD_ADDRESS || "";
    const tokenAAddress = process.env.TOKENA_ADDRESS || "";
    const tokenBAddress = process.env.TOKENB_ADDRESS || "";
    if (!rewardAddress || !tokenAAddress || !tokenBAddress) {
        console.log("Defina REWARD_ADDRESS, TOKENA_ADDRESS, TOKENB_ADDRESS no .env");
        return;
    }

    const reward = await ethers.getContractAt("RewardDistributor", rewardAddress);
    const tokenA = await ethers.getContractAt("TokenA", tokenAAddress);
    const tokenB = await ethers.getContractAt("TokenB", tokenBAddress);

    const participants = await reward.getParticipants();
    console.log("Participantes (", participants.length, "):");
    for (const p of participants) {
        const balA = await tokenA.balanceOf(p);
        const balB = await tokenB.balanceOf(p);
        const [, previewReward] = await reward.previewUserReward(p);
        console.log(`- ${p} | A: ${ethers.formatEther(balA)} | B: ${ethers.formatEther(balB)} | Próx B: ${ethers.formatEther(previewReward)}`);
    }

    console.log("Percent BPS:", await reward.rewardPercentBps());
    console.log("Block interval:", (await reward.blockInterval()).toString());
    console.log("Pode disparar agora?", await reward.canTrigger());
    console.log("Próximo bloco alvo:", (await reward.nextTriggerBlock()).toString());
}

main().catch(e => { console.error(e); process.exit(1); });
