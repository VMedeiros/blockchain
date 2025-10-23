import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const rewardAddress = process.env.REWARD_ADDRESS || "";
    if (!rewardAddress) {
        console.log("Defina REWARD_ADDRESS no .env");
        return;
    }
    const reward = await ethers.getContractAt("RewardDistributor", rewardAddress);

    console.log("canTrigger:", await reward.canTrigger());
    try {
        const tx = await reward.manualTrigger();
        await tx.wait();
        console.log("manualTrigger executado.");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("Falha manualTrigger:", msg);
    }

    const next = await reward.nextTriggerBlock();
    console.log("Aguardando intervalo para autoTrigger... next:", next.toString());
    const current = await ethers.provider.getBlockNumber();
    for (let i = current; i < next; i++) {
        await ethers.provider.send("evm_mine", []);
    }
    try {
        const tx2 = await reward.autoTrigger();
        await tx2.wait();
        console.log("autoTrigger executado.");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("Falha autoTrigger:", msg);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
