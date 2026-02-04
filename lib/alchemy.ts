import { Alchemy, Network } from "alchemy-sdk";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY!,
  network: Network.BASE_MAINNET,
};

export const alchemy = new Alchemy(settings);
