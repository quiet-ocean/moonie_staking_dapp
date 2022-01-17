import React, { Component } from "react";
import Web3 from 'web3'
import detectEthereumProvider from '@metamask/detect-provider'
import {
    AsteriskTokenABI, MooniFarmerABI, MooniGovernance, MooniAddress,
    AsteriskAddress, MooniFarmerAddress, MooniGovernanceAddress, MinTokenABI, PancakeFactoryAddress, PancakeFactoryABI
} from '../constant/contractABI'


import { useQuery } from '@apollo/client'
import { LPTOKEN_INFO_QUERY } from "../graphql/queries/query";
import { apolloProvider, apolloClient } from "../graphql/apollo";

class Balance extends Component {
    constructor(props) {
        super(props);
        this.state = {
            web3: {
                isInjected: false,
                walletType: 0,
                ethProvider: null,
                web3Instance: null,
                address: "",
                farmingContractInstance: null,
                asteriskContractInstance: null,
                pancakeFactoryContractInstance: null,
                networkId: 100
            },
            currentValueIndex: 0,
            values: [],
            currentAmount: {
                deposit: 0,
                withdraw: 0,
            }
        }
    }

    componentDidMount = () => {
        setInterval(async () => {
            this.updateInfo();
        }, 10000);
    }

    setMaxDeposit = () => {
        this.setState({
            currentAmount: {
                deposit: this.state.values[this.state.currentValueIndex].balance.wallet,
                withdraw: 0,
            }
        });
        console.log(this.state)
    }

    sendWithdrawTransaction = async () => {
        if (this.state.web3.isInjected) {
            let contractFarming = this.state.web3.farmingContractInstance;

            let amount = this.state.web3.web3Instance.utils.toBN(parseFloat(this.state.currentAmount.withdraw) * Math.pow(10, 18));

            try {
                let result2 = await contractFarming.methods.deposit(this.state.values[this.state.currentValueIndex].id, amount).send({ from: this.state.web3.address, gasLimit: 100000 });
            } catch (error) {

                console.log(error)
            }

        }
    }

    sendDepositTransaction = async () => {
        if (this.state.web3.isInjected) {
            let contractFarming = this.state.web3.farmingContractInstance;
            let contractLPToken = new this.state.web3.web3Instance.eth.Contract(MinTokenABI, this.state.values[this.state.currentValueIndex].token);
            
            let amount = this.state.web3.web3Instance.utils.toBN(parseFloat(this.state.currentAmount.deposit) * Math.pow(10, 18));

            contractLPToken.methods.approve(MooniFarmerAddress, amount.toString())
                .send({ from: this.state.web3.address, gasLimit: 100000 })
                .then(
                    async () => {
                        let result2 = await contractFarming.methods.withdraw(this.state.values[this.state.currentValueIndex].id, amount).send({ from: this.state.web3.address, gasLimit: 100000 });
                        console.log("success")
                    }
                ).catch(
                    (error) => {

                        console.log(error)
                    }
                );
        }
    }
    setMaxWithdraw = () => {
        this.setState({
            currentAmount: {
                deposit: 0,
                withdraw: this.state.values[this.state.currentValueIndex].balance.staked,
            }
        });
    }

    handleDepositAmount = (e) => {
        if (this.state.values.length < 1) return;
        if (parseFloat(e.target.value) > this.state.values[this.state.currentValueIndex].balance.wallet) {
            this.setState({
                currentAmount: {
                    deposit: this.state.values[this.state.currentValueIndex].balance.wallet,
                    withdraw: 0,
                }
            });
        } else {
            this.setState({
                currentAmount: {
                    deposit: e.target.value,
                    withdraw: 0,
                }
            });
        }
    }

    handleWithdrawAmount = (e) => {
        if (this.state.values.length < 1) return;
        if (parseFloat(e.target.value) > this.state.values[this.state.currentValueIndex].balance.staked) {
            this.setState({
                currentAmount: {
                    deposit: 0,
                    withdraw: this.state.values[this.state.currentValueIndex].balance.staked,
                }
            });
        } else {
            this.setState({
                currentAmount: {
                    deposit: 0,
                    withdraw: e.target.value,
                }
            });
        }
    }

    harvest = async (index) => {
        if (this.state.web3.isInjected) {
            let contractFarming = this.state.web3.farmingContractInstance;

            try {
                let result2 = await contractFarming.methods.deposit(this.state.values[index].id, 0).send({ from: this.state.web3.address, gasLimit: 100000 });
            } catch (error) {

                console.log(error)
            }

        }
    }
    updateInfo = async () => {
        try {
            if (this.state.web3.isInjected) {
                let contractFarming = this.state.web3.farmingContractInstance;
                let contractAsterisk = this.state.web3.asteriskContractInstance;
                let poolCount = await contractFarming.methods.poolLength().call();
                var temp = [];
                for (var i = 1; i < poolCount; i++) {
                    let poolInfo = await contractFarming.methods.poolInfo(i).call();
                    let contractLPToken = new this.state.web3.web3Instance.eth.Contract(MinTokenABI, poolInfo.lpToken);
                    let balance2 = await contractLPToken.methods.balanceOf(this.state.web3.address).call();
                    let tokenDecimal = await contractLPToken.methods.decimals().call();
                    //tokenDecimal = parseInt(tokenDecimal);
                    let balance = balance2 / Math.pow(10, tokenDecimal);
                    //console.log(balance2, typeof tokenDecimal, tokenDecimal)
                    let userInfo = await contractFarming.methods.userInfo(i, this.state.web3.address).call();
                    let pendingAmount = await contractFarming.methods.pending(i, this.state.web3.address).call();

                    let bonusMul = await contractFarming.methods.BONUS_MULTIPLIER().call();
                    let asteriskPerBlock = await contractFarming.methods.asteriskPerBlock().call();
                    let totalAllocPoint = await contractFarming.methods.totalAllocPoint().call();
                    let poolSupply = await contractLPToken.methods.balanceOf(MooniFarmerAddress).call();
                    //1000 100 1 1000 0
                    var apr;
                    if (poolSupply > 0) {
                        apr = {
                            value: 28800 / totalAllocPoint * bonusMul * asteriskPerBlock * poolInfo.allocPoint / poolSupply,
                            initialize: true,
                        }
                    } else {
                        apr = {
                            value: 0,
                            initialize: false,
                        }
                    }
                    let re = await apolloClient.query({
                        query: LPTOKEN_INFO_QUERY,
                        variables: {
                            address: poolInfo.lpToken
                        }
                    }
                    );
                    //console.log(re)
                    let element = {
                        id: i,
                        token: poolInfo.lpToken,
                        name: re.data.ethereum.dexTrades[0].baseCurrency.symbol + "-" + re.data.ethereum.dexTrades[0].quoteCurrency.symbol,
                        balance: {
                            wallet: balance ,
                            staked: userInfo.amount / Math.pow(10, tokenDecimal) ,
                            earned: pendingAmount / Math.pow(10, 18) ,
                            isMooniReward: poolInfo.isMooniBnb
                        },
                        apr: apr,
                        amount: {
                            liquidity: poolSupply / Math.pow(10, tokenDecimal),
                        }
                    };


                    temp.push(element);
                }

                console.log(temp)
                this.setState({
                    values: temp
                });
            }
        } catch {
            console.log("error")
        }
    }

    approveAsteriskToMetamask = async () => {
        if (this.state.web3.isInjected) {
            const wasAdded = await this.state.web3.ethProvider.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20', // Initially only supports ERC20, but eventually more!
                    options: {
                        address: AsteriskAddress, // The address that the token is at.
                        symbol: "ASK", // A ticker symbol or shorthand, up to 5 chars.
                        decimals: 18, // The number of decimals in the token
                        image: "", // A string url of the token logo
                    },
                },
            });
        }
    }

    getFarmerContractInstance = (web3Instance) => {
        if (web3Instance) {
            let contract = new web3Instance.eth.Contract(MooniFarmerABI, MooniFarmerAddress);
            return contract;
        }
        else {
            return null;
        }
    }

    getAsteriskContractInstance = (web3Instance) => {
        if (web3Instance) {
            let contract = new web3Instance.eth.Contract(AsteriskTokenABI, AsteriskAddress);
            return contract;
        }
        else {
            return null;
        }
    }
    getPancakeFactoryContractInstance = (web3Instance) => {
        if (web3Instance) {
            let contract = new web3Instance.eth.Contract(PancakeFactoryABI, PancakeFactoryAddress);
            return contract;
        }
        else {
            return null;
        }
    }
    connectMetamask = async (walletType) => {
        const currentProvider = await detectEthereumProvider();
        if (currentProvider && walletType == 0) {
            // console.log('Installed MetaMask!');
            // console.log(currentProvider)
            // console.log(window.ethereum)
            // console.log(window.web3)
            let web3Instance = new Web3(currentProvider);
            if (!window.ethereum.selectedAddress) {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
            }
            await window.ethereum.enable();
            let currentAddress = window.ethereum.selectedAddress;
            const chainId = await currentProvider.request({
                method: 'eth_chainId'
            })
            this.setState({
                web3: {
                    isInjected: true,
                    walletType: walletType,
                    ethProvider: window.ethereum,
                    web3Instance: web3Instance,
                    address: currentAddress,
                    farmingContractInstance: this.getFarmerContractInstance(web3Instance),
                    asteriskContractInstance: this.getAsteriskContractInstance(web3Instance),
                    pancakeFactoryContractInstance: this.getPancakeFactoryContractInstance(web3Instance),
                    networkId: chainId,
                }
            });
            await this.updateInfo();
            //context.commit(type.SET_CONTRACT, data);
            //console.log(this.state);
        } else {
            console.log('Please install MetaMask!');
        }
    }
    setCurrentId = (index) => {
        console.log(index)
        console.log(this.state.values)
        this.setState(
            { currentValueIndex: index }
        );
    }
    render() {
        return (
            <>
                <header>
                    <nav className="navbar navbar-top-default navbar-expand-lg navbar-simple nav-line">
                        <div className="container">
                            <a href="#slider-section" title="Logo" className="logo scroll">
                                <img src="/vendor/moonitemplate/images/mooni_logo.png" alt="logo" className="ml-lg-3 m-0" />
                            </a>

                            <div className="collapse navbar-collapse" id="megaone">
                                <div className="navbar-nav ml-auto">
                                    <a className="nav-link line" href="/">Home</a>
                                    <a className="nav-link line" href="/stake">Stake</a>
                                    <a className="nav-link line" href="#" data-toggle="modal" data-target="#connectWalletModal">Connect Wallet</a>
                                    <a href="https://exchange.pancakeswap.finance/#/swap?inputCurrency=0xed438051437c22a9ef249b68c7e292435fe8b858" target="_blank" className="btn btn-medium btn-rounded btn-pink nav-button">Buy</a>
                                </div>
                            </div>
                        </div>

                        <div className="navigation-toggle">
                            <ul className="slider-social toggle-btn my-0">
                                <li>
                                    <a href="javascript:void(0);" className="sidemenu_btn" id="sidemenu_toggle">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </nav>

                    <div className="side-menu hidden">

                        <span id="btn_sideNavClose">
                            <i className="las la-times btn-close"></i>
                        </span>
                        <div className="inner-wrapper">
                            <nav className="side-nav w-100">
                                <a href="#slider-section" title="Logo" className="logo scroll navbar-brand">
                                    <img src="/vendor/moonitemplate/images/mooni_logo.png" alt="logo" />
                                </a>
                                <ul className="navbar-nav text-capitalize">
                                    <li className="nav-item">
                                        <a className="nav-link" href="index.html">Home</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="stake.html">Stake</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link line" href="#" data-toggle="modal" data-target="#connectWalletModal">Connect Wallet</a>
                                    </li>
                                    <li className="nav-item">
                                        <a href="https://exchange.pancakeswap.finance/#/swap?inputCurrency=0xed438051437c22a9ef249b68c7e292435fe8b858" target="_blank" className="btn btn-medium btn-rounded btn-pink nav-button">Buy</a>
                                    </li>
                                </ul>
                            </nav>

                            <div className="side-footer w-100">
                                <ul className="social-icons-simple">
                                    <li><a className="social-icon wow fadeInRight" href="https://twitter.com/moonidefi" data-wow-delay="300ms"><i className="fab fa-twitter"></i> </a> </li>
                                    <li><a className="social-icon wow fadeInLeft" href="https://t.me/moonichat" data-wow-delay="300ms"><i className="fab fa-telegram-plane"></i> </a> </li>
                                    <li><a className="social-icon wow fadeInRight" href="https://moonidefi.medium.com/" data-wow-delay="300ms"><i className="fab fa-medium"></i> </a> </li>
                                </ul>
                                <p>&copy; 2021 M O O N I DeFi - Binance Smart Chain</p>
                            </div>
                        </div>
                    </div>
                    <a id="close_side_menu" href="#"></a>
                </header>

                <div className="balance-section">
                    <div className="container">
                        {
                            this.state.values.length > 0 ? this.state.values.map((item, idx) => (
                                <div className="select-div mb-4 font-weight-500">
                                    <div className="row menu-div">
                                        <div className="col-3 d-flex align-items-center mr-3">
                                            <img className="" width="90px" src="/vendor/moonitemplate/images/mooni_logo.png" alt="image" />
                                            <div>
                                                <p className="text-white mb-1">FARMING</p>
                                                <h5 className="text-pink mb-1 font-weight-600">{item.name}</h5>
                                            </div>
                                        </div>
                                        <div className="col-8 row">
                                            <div className="col">
                                                <p className="text-grey mb-1 font-14">Earned</p>
                                                <p className="text-pink mb-1">{item.balance.earned}</p>
                                            </div>
                                            <div className="col">
                                                <p className="text-grey mb-1 font-14">APR</p>
                                                <p className="text-pink mb-1">{item.apr.initialize ? item.apr.value : "Loading..."}</p>
                                            </div>
                                            <div className="col">
                                                <p className="text-grey mb-1 font-14">Liquidity</p>
                                                <p className="text-white mb-1">{item.amount.liquidity}</p>
                                            </div>
                                        </div>
                                        <div className="col-1 d-flex dropdown-icon text-grey" style={{ cursor: "pointer" }} data-toggle="collapse" data-target={`#single_dropdown_div_${idx}`}>
                                            <p className="mb-0 mr-2">Details</p>
                                            <div>
                                                <i className="fas fa-chevron-down"></i>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="row dropdown-div collapse" id={`single_dropdown_div_${idx}`}>
                                        <div className="col-md-6 col-sm-12">
                                            <div className="card">
                                                <div className="card-body">
                                                    <p className="mb-1 text-grey font-14">{item.balance.isMooniReward ? "MOONI" : "ASK"} EARNED</p>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <p className="mb-0 text-pink font-22 font-weight-700">{item.balance.earned}</p>
                                                        <button onClick={() => { this.harvest(idx) }} className="btn btn-medium btn-rounded btn-pink" style={{ width: "40%", height: "50px", "lineJeight": "18px" }}>Harvest</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-6 col-sm-12">
                                            <div className="card">
                                                <div className="card-body">
                                                    <p className="mb-1 text-grey font-14">{item.name} LP STAKED</p>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <p className="mb-0 text-pink font-22 font-weight-700">{item.balance.staked}</p>
                                                        <div className="d-flex">
                                                            <button onClick={() => { this.setCurrentId(idx) }} className="btn btn-medium btn-rounded btn-pink-outline mr-2" data-toggle="modal" data-target="#stakeModal" style={{ width: "50px", height: "50px", lineHeight: "18px" }}>
                                                                <i className="fa fa-plus"></i>
                                                            </button>
                                                            <button onClick={() => { this.setCurrentId(idx) }} className="btn btn-medium btn-rounded btn-pink-outline" data-toggle="modal" data-target="#unstakeModal" style={{ width: "50px", height: "50px", lineHeight: "18px" }}>
                                                                <i className="fa fa-minus"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : ""
                        }

                    </div>
                </div>

                <div className="modal fade" id="stakeModal" tabIndex="-1" role="dialog" aria-labelledby="stakeModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title text-white" id="stakeModalLabel">Stake {this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].name : ""} LP Tokens</h5>
                                <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body has-error">
                                <div className="invalid" style={{ backgroundColor: "#2b243a", padding: "14px", borderRadius: "14px" }}>
                                    <div className="d-flex justify-content-between">
                                        <p className="mb-2 text-white font-14 font-weight-500">Stake</p>
                                        <p className="text-right mb-2 text-white font-14 font-weight-500">Balance: {this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].balance.wallet : 0}</p>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <input
                                            onChange={this.handleDepositAmount}
                                            value={this.state.currentAmount.deposit}
                                            className="form-control" style={{ padding: "10px 0" }} type="number" step="0.0001" />
                                        <button onClick={this.setMaxDeposit} className="btn btn-medium btn-rounded btn-pink" style={{ height: "30px", lineHeight: "8px", padding: "10px 20px" }}>Max</button>
                                        <p className="mb-0 text-pink font-weight-600">{this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].name : ""} LP</p>
                                    </div>
                                </div>
                                {/* <div className="error">
                                    <span className="font-14">No tokens to stake: get {this.state.values.length > 1 ? this.state.values[this.state.currentValueIndex].name:""} LP</span>
                                </div> */}
                                <div className="text-center my-4">
                                    <button className="btn btn-medium btn-rounded btn-pink-outline mr-3" data-dismiss="modal" style={{ width: "44%", height: "54px", lineHeight: "18px" }}>Cancel</button>
                                    <button onClick={this.sendDepositTransaction} className="btn btn-medium btn-rounded btn-secondary" style={{ width: "44%", height: "54px", lineHeight: "18px" }}>Confirm</button>
                                </div>
                                <div className="text-center">
                                    <a href="#" className="text-purple font-weight-600">Get {this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].name : ""} LP<i className="fas fa-external-link-alt"></i></a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal fade" id="unstakeModal" tabIndex="-1" role="dialog" aria-labelledby="unstakeModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title text-white" id="unstakeModalLabel">Unstake {this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].name : ""} LP Tokens</h5>
                                <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-4" style={{ backgroundColor: "#2b243a", padding: "14px", borderRadius: "14px" }}>
                                    <div className="d-flex justify-content-between">
                                        <p className="mb-2 text-white font-14 font-weight-500">Unstake</p>
                                        <p className="text-right mb-2 text-white font-14 font-weight-500">Balance: {this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].balance.staked : 0}</p>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <input value={this.state.currentAmount.withdraw} onChange={this.handleWithdrawAmount} className="form-control" style={{ padding: "10px 0" }} type="number" step="0.0001" />
                                        <button onClick={this.setMaxWithdraw} className="btn btn-medium btn-rounded btn-pink" style={{ height: "30px", lineHeight: "8px", padding: "10px 20px" }}>Max</button>
                                        <p className="mb-0 text-pink font-weight-600">{this.state.values.length > 0 ? this.state.values[this.state.currentValueIndex].name : ""} LP</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <button className="btn btn-medium btn-rounded btn-pink-outline mr-3" data-dismiss="modal" style={{ width: "44%", height: "54px", lineHeight: "18px" }}>Cancel</button>
                                    <button onClick={this.sendWithdrawTransaction} className="btn btn-medium btn-rounded btn-secondary" style={{ width: "44%", height: "54px", lineHeight: "18px" }}>Confirm</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal fade" id="connectWalletModal" tabIndex="-1" role="dialog" aria-labelledby="connectWalletModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title text-white" id="connectWalletModalLabel">Connect Wallets</h5>
                                <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div onClick={() => this.connectMetamask(0)} className="d-flex justify-content-between align-items-center wallet-div" data-dismiss="modal">
                                    <p className="text-white mb-0">Metamask</p>
                                    <img width="30px" src="/vendor/moonitemplate/images/metamask.png" alt="image" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }
}

export default Balance;