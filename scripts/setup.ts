import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [, u1, u2, u3] = await ethers.getSigners();
    const rewardAddress = process.env.REWARD_ADDRESS || "";
    const tokenAAddress = process.env.TOKENA_ADDRESS || "";
    if (!rewardAddress || !tokenAAddress) {
        console.log("Defina REWARD_ADDRESS e TOKENA_ADDRESS no .env");
        return;
    }
    const reward = await ethers.getContractAt("RewardDistributor", rewardAddress);
    const tokenA = await ethers.getContractAt("TokenA", tokenAAddress);

    console.log("Adicionando participantes...");
    for (const addr of [u1.address, u2.address, u3.address]) {
        try {
            const tx = await reward.addParticipant(addr);
            await tx.wait();
            console.log("OK:", addr);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log("Falha add", addr, msg);
        }
    }

    console.log("Distribuindo TokenA de teste...");
    await (await tokenA.transfer(u1.address, ethers.parseEther("100"))).wait();
    await (await tokenA.transfer(u2.address, ethers.parseEther("35"))).wait();
    await (await tokenA.transfer(u3.address, ethers.parseEther("60"))).wait();

    console.log("Preview recompensas antes do trigger:");
    const result = await reward.previewAllRewards();
    const accounts: string[] = result[0];
    const rewards: bigint[] = result[1];
    accounts.forEach((a, i) => console.log(a, ethers.formatEther(rewards[i])));

    console.log(
        "OK. Execute: npx hardhat console --network localhost para testar manualTrigger()"
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
