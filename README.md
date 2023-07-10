<p align="center">
  <a href="https://algebra.finance/"><img alt="Algebra" src="logo.svg" width="360"></a>
</p>

<p align="center">
Innovative DEX with concentrated liquidity, adaptive fee, build-in farming etc.
</p>
 
 <p align="center">
 <a href="https://github.com/cryptoalgebra/AlgebraV1/actions/workflows/tests.yml"><img alt="Tests status" src="https://github.com/cryptoalgebra/AlgebraV1/actions/workflows/tests.yml/badge.svg"></a>
  <a href="https://github.com/cryptoalgebra/AlgebraV1/actions/workflows/echidna.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/AlgebraV1/actions/workflows/echidna.yml/badge.svg"></a>
</p>

- [Docs](#Docs)
- [Versions](#Versions)
- [Packages](#Packages)
- [Build](#Build)
- [Tests](#Tests)
- [Coverage](#Tests-coverage)
- [Deploy](#Deploy)

## Docs

The current short documentation page is located at: <a href="https://docs.algebra.finance/en/docs/contracts/API-reference-v1.0/introduction">API reference</a>

We are currently in the process of creating a more complete and comprehensive version of the documentation.

## Versions

Please note that different DEX-partners of our protocol may use different versions of the protocol. 

This repository contains smart contracts that belong to the first version of the protocol (Algebra V1.0.0).

A page describing the versions used by partners can be found in the documentation: [partners page](https://docs.algebra.finance/en/docs/contracts/partners/introduction)

## Packages 

Full packages:

[@cryptoalgebra/core v2.0.0](https://www.npmjs.com/package/@cryptoalgebra/core/v/2.0.0)

[@cryptoalgebra/periphery v1.0.0](https://www.npmjs.com/package/@cryptoalgebra/periphery/v/1.0.0)

Only interfaces:

[@cryptoalgebra/solidity-interfaces](https://www.npmjs.com/package/@cryptoalgebra/solidity-interfaces)

## Build

*Requires npm >= 8.0.0*

To install dependencies, you need to run the command in the root directory:
```
$ npm run bootstrap
```
This will download and install dependencies for all modules and set up husky hooks.



To compile a specific module, you need to run the following command in the module folder:
```
$ npm run compile
```


## Tests

Tests for a specific module are run by the following command in the module folder:
```
$ npm run test
```

## Tests coverage

To get a test coverage for specific module, you need to run the following command in the module folder:

```
$ npm run coverage
```

## Deploy
Firstly you need to create `.env` file in the root directory of project as in `env.example`.

To deploy all modules in specific network:
```
$ node scripts/deployAll.js <network>
```
