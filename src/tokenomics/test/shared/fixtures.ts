import { constants, Wallet } from 'ethers'
import { ethers } from 'hardhat'

import AlgebraPool from '@cryptoalgebra/v1-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json'
import AlgebraFactoryJson from '@cryptoalgebra/v1-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json'
import AlgebraPoolDeployerJson from '@cryptoalgebra/v1-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json'
import NFTDescriptorJson from '@cryptoalgebra/v1-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json'
import NonfungiblePositionManagerJson from '@cryptoalgebra/v1-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import NonfungibleTokenPositionDescriptor from '@cryptoalgebra/v1-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'
import SwapRouter from '@cryptoalgebra/v1-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import WNativeToken from './external/WNativeToken.json'
import { linkLibraries } from './linkLibraries'
import { ISwapRouter,IWNativeToken,NFTDescriptor } from '@cryptoalgebra/v1-periphery/typechain'
import {
  AlgebraLimitFarming,
  AlgebraEternalFarming,
  TestERC20,
  INonfungiblePositionManager,
  IAlgebraFactory,
  IAlgebraPoolDeployer,
  IAlgebraPool,
  TestIncentiveId,
  FarmingCenter, 
  FarmingCenterVault
} from '../../typechain'
import { FeeAmount, BigNumber, encodePriceSqrt, MAX_GAS_LIMIT } from '../shared'
import { ActorFixture } from './actors'

type WNativeTokenFixture = { wnative: IWNativeToken }

export const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a';

export const wnativeFixture: () => Promise<WNativeTokenFixture> = async () => {
  const wnativeFactory = await ethers.getContractFactory(WNativeToken.abi, WNativeToken.bytecode);
  const wnative = (await wnativeFactory.deploy()) as IWNativeToken

  return { wnative }
}

const v3CoreDeployerFixture: () => Promise<IAlgebraPoolDeployer> = async () => {
  const deployerFactory = await ethers.getContractFactory(AlgebraPoolDeployerJson.abi, AlgebraPoolDeployerJson.bytecode);
  return (await deployerFactory.deploy()) as IAlgebraPoolDeployer
}

const v3CoreFactoryFixture: () => Promise<[IAlgebraFactory,IAlgebraPoolDeployer]> = async () => {
  const deployer = await v3CoreDeployerFixture()
  const factoryFactory = await ethers.getContractFactory(AlgebraFactoryJson.abi, AlgebraFactoryJson.bytecode);
  const factory = (await factoryFactory.deploy(deployer.address, vaultAddress)) as IAlgebraFactory;

  await deployer.setFactory(factory.address)

  return [factory, deployer]
}



export const v3RouterFixture: () => Promise<{
  wnative: IWNativeToken
  factory: IAlgebraFactory
  deployer: IAlgebraPoolDeployer
  router: ISwapRouter
}> = async () => {
  const { wnative } = await wnativeFixture()
  const [factory,deployer] = await v3CoreFactoryFixture()
  const routerFactory = await ethers.getContractFactory(SwapRouter.abi, SwapRouter.bytecode);
  const router = (await routerFactory.deploy(factory.address, wnative.address, deployer.address)) as ISwapRouter

  return { factory, wnative, deployer, router }
}

const nftDescriptorLibraryFixture: () => Promise<NFTDescriptor> = async () => {
  const NFTDescriptorFactory = await ethers.getContractFactory(NFTDescriptorJson.abi, NFTDescriptorJson.bytecode);
  return (await NFTDescriptorFactory.deploy()) as NFTDescriptor
}

type AlgebraFactoryFixture = {
  wnative: IWNativeToken
  factory: IAlgebraFactory
  deployer: IAlgebraPoolDeployer
  router: ISwapRouter
  nft: INonfungiblePositionManager
  tokens: [TestERC20, TestERC20, TestERC20,TestERC20]
}

export const algebraFactoryFixture: () => Promise<AlgebraFactoryFixture> = async () => {
  const { wnative, factory, deployer, router } = await v3RouterFixture()

  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokens = (await Promise.all([
    tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
    tokenFactory.deploy(constants.MaxUint256.div(2)),
    tokenFactory.deploy(constants.MaxUint256.div(2)),
    tokenFactory.deploy(constants.MaxUint256.div(2)),
  ])) as [TestERC20, TestERC20, TestERC20,TestERC20]

  const nftDescriptorLibrary = await nftDescriptorLibraryFixture()

  const linkedBytecode = linkLibraries(
    {
      bytecode: NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        'NFTDescriptor.sol': {
          NFTDescriptor: [
            {
              length: 20,
              start: 1246,
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptorLibrary.address,
    }
  )

  const NFTDescriptorFactory = await ethers.getContractFactory(NonfungibleTokenPositionDescriptor.abi, linkedBytecode);

  const positionDescriptor = await NFTDescriptorFactory.deploy(tokens[0].address);
  


  const nftFactory = await ethers.getContractFactory(
    NonfungiblePositionManagerJson.abi,
    NonfungiblePositionManagerJson.bytecode
  )

  const nft = (await nftFactory.deploy(
    factory.address,
    wnative.address,
    positionDescriptor.address,
    deployer.address
  )) as INonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    wnative,
    factory,
    deployer,
    router,
    tokens,
    nft,
  }
}

export const mintPosition = async (
  nft: INonfungiblePositionManager,
  mintParams: {
    token0: string
    token1: string
    fee: FeeAmount
    tickLower: number
    tickUpper: number
    recipient: string
    amount0Desired: any
    amount1Desired: any
    amount0Min: number
    amount1Min: number
    deadline: number
  }
): Promise<string> => {
  const transferFilter = nft.filters.Transfer(null, null, null)
  const transferTopic = nft.interface.getEventTopic('Transfer')

  let tokenId: BigNumber | undefined

  const receipt = await (
    await nft.mint(
      {
        token0: mintParams.token0,
        token1: mintParams.token1,
        tickLower: mintParams.tickLower,
        tickUpper: mintParams.tickUpper,
        recipient: mintParams.recipient,
        amount0Desired: mintParams.amount0Desired,
        amount1Desired: mintParams.amount1Desired,
        amount0Min: mintParams.amount0Min,
        amount1Min: mintParams.amount1Min,
        deadline: mintParams.deadline,
      },
      {
        gasLimit: MAX_GAS_LIMIT,
      }
    )
  ).wait()

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i]
    if (log.address === nft.address && log.topics.includes(transferTopic)) {
      // for some reason log.data is 0x so this hack just re-fetches it
      const events = await nft.queryFilter(transferFilter, log.blockHash)
      if (events.length === 1) {
        tokenId = events[0].args?.tokenId
      }
      break
    }
  }

  if (tokenId === undefined) {
    throw 'could not find tokenId after mint'
  } else {
    return tokenId.toString()
  }
}

export type AlgebraFixtureType = {
  deployer: IAlgebraPoolDeployer
  fee: FeeAmount
  nft: INonfungiblePositionManager
  pool01: string
  pool12: string
  factory: IAlgebraFactory
  poolObj: IAlgebraPool
  router: ISwapRouter
  farming: AlgebraLimitFarming
  eternalFarming: AlgebraEternalFarming
  farmingCenter: FarmingCenter
  testIncentiveId: TestIncentiveId
  tokens: [TestERC20, TestERC20, TestERC20, TestERC20]
  token0: TestERC20
  token1: TestERC20
  rewardToken: TestERC20
  bonusRewardToken: TestERC20
  farmingCenterVault: FarmingCenterVault
}
export const algebraFixture: () => Promise<AlgebraFixtureType> = async () => {
  const { tokens, nft, factory, deployer, router } = await algebraFactoryFixture()

  const wallets = (await ethers.getSigners() as any) as Wallet[];
  const signer = new ActorFixture(wallets, ethers.provider).farmingDeployer()

  const incentiveCreator = new ActorFixture(wallets, ethers.provider).incentiveCreator()
  
  const farmingFactory = await ethers.getContractFactory('AlgebraLimitFarming', signer)

  const farming = (await farmingFactory.deploy(deployer.address, nft.address, 2 ** 32, 2 ** 32)) as AlgebraLimitFarming

  const eternalFarmingFactory = await ethers.getContractFactory('AlgebraEternalFarming', signer)

  const eternalFarming = (await eternalFarmingFactory.deploy(deployer.address, nft.address)) as AlgebraEternalFarming

  const farmingCenterVaultFactory = await ethers.getContractFactory('FarmingCenterVault', signer) 

  const farmingCenterVault = (await farmingCenterVaultFactory.deploy()) as FarmingCenterVault

  const farmingCenterFactory = await ethers.getContractFactory('FarmingCenter', signer) 

  const farmingCenter = (await farmingCenterFactory.deploy(farming.address,eternalFarming.address, nft.address, farmingCenterVault.address)) as FarmingCenter
  
  await eternalFarming.setFarmingCenterAddress(farmingCenter.address)

  await eternalFarming.setIncentiveMaker(incentiveCreator.address)

  await farming.setFarmingCenterAddress(farmingCenter.address)

  await factory.setFarmingAddress(farmingCenter.address)

  await farmingCenterVault.setFarmingCenter(farmingCenter.address)
 
  await farming.setIncentiveMaker(incentiveCreator.address)
  const testIncentiveIdFactory = await ethers.getContractFactory('TestIncentiveId', signer)
  const testIncentiveId = (await testIncentiveIdFactory.deploy()) as TestIncentiveId

  for (const token of tokens) {
    await token.approve(nft.address, constants.MaxUint256)
  }
  
  const fee = FeeAmount.MEDIUM

  await nft.createAndInitializePoolIfNecessary(tokens[0].address ,tokens[1].address, encodePriceSqrt(1, 1))

  await nft.createAndInitializePoolIfNecessary(tokens[1].address, tokens[2].address, encodePriceSqrt(1, 1))
  
  const pool01 = await factory.poolByPair(tokens[0].address, tokens[1].address)
  
  const pool12 = await factory.poolByPair(tokens[1].address, tokens[2].address)
  
  const poolObj = poolFactory.attach(pool01) as IAlgebraPool

  return {
    nft,
    router,
    tokens,
    farming,
    eternalFarming,
    farmingCenter,
    farmingCenterVault,
    testIncentiveId,
    deployer,
    factory,
    pool01,
    pool12,
    fee,
    poolObj,
    token0: tokens[0],
    token1: tokens[1],
    rewardToken: tokens[2],
    bonusRewardToken: tokens[1]
  }
}


export const poolFactory = new ethers.ContractFactory(AlgebraPool.abi, AlgebraPool.bytecode)
