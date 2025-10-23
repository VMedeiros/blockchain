import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const rewardAddress = process.env.REWARD_ADDRESS;
    if (!rewardAddress) {
        throw new Error("Defina REWARD_ADDRESS no .env ou na linha de comando");
    }

    const reward = await ethers.getContractAt("RewardDistributor", rewardAddress);
    const [accounts, rewards] = await reward.previewAllRewards();
    console.log("Preview de recompensas (percent BPS:", await reward.rewardPercentBps(), ")");
    accounts.forEach((acc: string, i: number) => {
        console.log(`${acc} => ${ethers.formatEther(rewards[i])} TokenB`);
    });
    const can = await reward.canTrigger();
    console.log("Pode disparar agora?", can);
    if (!can) {
        const next = await reward.nextTriggerBlock();
        console.log("Próximo bloco para disparo:", next.toString());
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});