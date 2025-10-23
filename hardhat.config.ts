import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 } }
    },
    gasReporter: process.env.REPORT_GAS ? {
        enabled: true,
        currency: 'USD',
        excludeContracts: ['ERC20'],
    } : undefined,
    networks: {
        hardhat: { chainId: 31337 },
        ...(ALCHEMY_API_KEY && PRIVATE_KEY
            ? {
                sepolia: {
                    url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
                    accounts: [PRIVATE_KEY]
                }
            }
            : {})
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || ""
    }
};

export default config;
