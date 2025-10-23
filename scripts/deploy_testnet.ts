import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const percentBps = parseInt(process.env.REWARD_PERCENT_BPS || "5000", 10);
    const blockInterval = parseInt(process.env.BLOCK_INTERVAL || "6400", 10);

    const TokenA = await ethers.getContractFactory("TokenA");
    const tokenA = await TokenA.deploy(ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    console.log("TokenA:", await tokenA.getAddress());

    const TokenB = await ethers.getContractFactory("TokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();
    console.log("TokenB:", await tokenB.getAddress());

    const Reward = await ethers.getContractFactory("RewardDistributor");
    const reward = await Reward.deploy(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        percentBps,
        blockInterval
    );
    await reward.waitForDeployment();
    console.log("RewardDistributor:", await reward.getAddress());

    const MINTER_ROLE = ethers.id("MINTER_ROLE");
    await (await tokenB.grantRole(MINTER_ROLE, await reward.getAddress())).wait();

    console.log("Configurar participantes manualmente chamando addParticipant() em console.");
    console.log("Exemplo console:");
    console.log(
        `const reward = await ethers.getContractAt('RewardDistributor','${await reward.getAddress()}')`
    );
    console.log("await reward.addParticipant('ADDRESS')");
    console.log("Percent BPS:", percentBps, "Intervalo blocos:", blockInterval);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
