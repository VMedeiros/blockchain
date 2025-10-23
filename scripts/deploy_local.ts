import { ethers } from "hardhat";

async function main() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const TokenA = await ethers.getContractFactory("TokenA");
    const tokenA = await TokenA.deploy(ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    console.log("TokenA deployed:", await tokenA.getAddress());

    const TokenB = await ethers.getContractFactory("TokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();
    console.log("TokenB deployed:", await tokenB.getAddress());

    const percentBps = 5000; // 50% exemplo
    const blockInterval = 50; // intervalo de blocos para autoTrigger
    const Reward = await ethers.getContractFactory("RewardDistributor");
    const reward = await Reward.deploy(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        percentBps,
        blockInterval
    );
    await reward.waitForDeployment();
    console.log("RewardDistributor deployed:", await reward.getAddress());

    // Transferir ownership de TokenB para o contrato Reward (ele passará a mintar)
    await (await tokenB.transferOwnership(await reward.getAddress())).wait();

    // participantes
    await (await reward.addParticipant(user1.address)).wait();
    await (await reward.addParticipant(user2.address)).wait();
    await (await reward.addParticipant(user3.address)).wait();

    // distribuir TokenA de teste
    await (await tokenA.transfer(user1.address, ethers.parseEther("100"))).wait();
    await (await tokenA.transfer(user2.address, ethers.parseEther("35"))).wait();
    await (await tokenA.transfer(user3.address, ethers.parseEther("60"))).wait();

    console.log("Console exemplos:");
    console.log("npx hardhat console --network hardhat");
    console.log(
        `const reward = await ethers.getContractAt('RewardDistributor','${await reward.getAddress()}')`
    );
    console.log("await reward.manualTrigger() // alias de triggerManual");
    console.log("// Para autoTrigger após intervalo: await reward.autoTrigger() ");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
