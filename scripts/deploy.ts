import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const TokenA = await ethers.getContractFactory("TokenA");
    const tokenA = await TokenA.deploy(ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    console.log("TokenA:", await tokenA.getAddress());

    const TokenB = await ethers.getContractFactory("TokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();
    console.log("TokenB:", await tokenB.getAddress());

    const percentBps = 5000;
    const blockInterval = 50;
    const Reward = await ethers.getContractFactory("RewardDistributor");
    const reward = await Reward.deploy(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        percentBps,
        blockInterval
    );
    await reward.waitForDeployment();
    console.log("RewardDistributor:", await reward.getAddress());

    await (await tokenB.transferOwnership(await reward.getAddress())).wait();
    console.log("Ownership TokenB -> Reward OK");

    console.log("SET VARS (.env):");
    console.log("REWARD_ADDRESS=" + (await reward.getAddress()));
    console.log("TOKENA_ADDRESS=" + (await tokenA.getAddress()));
    console.log("TOKENB_ADDRESS=" + (await tokenB.getAddress()));
    console.log("Execute scripts/setup.ts depois para participantes e mint inicial.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
