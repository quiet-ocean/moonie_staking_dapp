// SPDX-License-Identifier: Unlicensed
pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MooniGovernance.sol";
import "./AsteriskToken.sol";

contract MooniFarmer is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 rewardDebtForMooni; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of CAKEs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accTokenPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accTokenPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. CAKEs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that CAKEs distribution occurs.
        uint256 accTokenPerShare; // Accumulated CAKEs per share, times 1e12. See below.
        uint256 lpRewardWeight;
        uint256 accumulatedMooni;
        bool isMooniBnb;
    }

    bool public isMooniRewardPossible;
    // The MOONI TOKEN!
    IERC20 public mooni;

    // The Asterisk TOKEN!
    AsteriskToken public asterisk;
    // The SYRUP TOKEN!
    MooniGovernance public gov;
    // Dev address.
    address public devaddr;
    // Mooni tokens created per block.
    uint256 public mooniPerBlock;
    // Asterisk tokens created per block.
    uint256 public asteriskPerBlock;
    // Bonus muliplier for early mooni makers.
    uint256 public BONUS_MULTIPLIER = 1;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    //IMigratorChef public migrator;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when Asterisk mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IERC20 _mooni,
        MooniGovernance _gov,
        address _devaddr,
        uint256 _mooniPerBlock,
        uint256 _startBlock
    ) public {
        isMooniRewardPossible = true;
        mooni = _mooni;
        gov = _gov;
        devaddr = _devaddr;
        mooniPerBlock = _mooniPerBlock;
        startBlock = _startBlock;

        // staking pool
        poolInfo.push(PoolInfo({
        lpToken: asterisk,
        allocPoint: 1000,
        lastRewardBlock: startBlock,
        accTokenPerShare: 0,
        lpRewardWeight:0,
        isMooniBnb: false,
        accumulatedMooni:0
        }));

        totalAllocPoint = 1000;

    }

    function updateMultiplier(uint256 multiplierNumber) public onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate, bool _isMooniBnb, uint256 _lpRewardWeight) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
        lpToken: _lpToken,
        allocPoint: _allocPoint,
        lastRewardBlock: lastRewardBlock,
        accTokenPerShare: 0,
        isMooniBnb:_isMooniBnb,
        lpRewardWeight: (_isMooniBnb ?_lpRewardWeight:0),
        accumulatedMooni:0
        }));
        updateStakingPool();
    }

    // Update the given pool's allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate, uint256 _lpRewardWeight) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;

        if(poolInfo[_pid].isMooniBnb){
            poolInfo[_pid].lpRewardWeight = _lpRewardWeight;
        }

        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            updateStakingPool();
        }
    }

    function updateStakingPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        if (points != 0) {
            points = points.div(4);
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(points);
            poolInfo[0].allocPoint = points;
        }
    }


    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return getCalculatedMultiplier(_from, _to).mul(BONUS_MULTIPLIER);
    }

    function getCalculatedMultiplier(uint256 _from, uint256 _to) public view returns(uint256) {
        return _to.sub(_from);
    }

    // View function to see pending rewards on frontend.
    function pendingMooni(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 mooniReward = multiplier.mul(mooniPerBlock).mul(pool.lpRewardWeight);
        }
        return pool.accumulatedMooni.mul(user.amount).sub(user.rewardDebtForMooni);
    }

    function pending(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 asteriskReward = multiplier.mul(asteriskPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accTokenPerShare = accTokenPerShare.add(asteriskReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
    }
    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 mooniReward = multiplier.mul(mooniPerBlock).mul(pool.lpRewardWeight);
        uint256 asteriskReward = multiplier.mul(asteriskPerBlock).mul(pool.allocPoint).div(totalAllocPoint);

        asterisk.mint(devaddr, asteriskReward.div(12));
        asterisk.mint(address(gov), asteriskReward);

        if(isMooniRewardPossible && pool.isMooniBnb) {
            pool.accumulatedMooni = pool.accumulatedMooni.add(mooniReward);
        }

        pool.accTokenPerShare = pool.accTokenPerShare.add(asteriskReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MooniFarmer for  allocation.
    function deposit(uint256 _pid, uint256 _amount) public {

        require (_pid != 0, 'deposit asterisk by staking');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);

                if(pool.isMooniBnb && isMooniRewardPossible)
                {
                    safeMooniTransfer(msg.sender, pool.accumulatedMooni.mul(user.amount).sub(user.rewardDebtForMooni));
                    user.rewardDebtForMooni = user.amount.mul(pool.accumulatedMooni);
                }
                else{
                    if(pending > 0) {
                        safeAsteriskTransfer(msg.sender, pending);
                    }
                }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        if(pool.isMooniBnb && isMooniRewardPossible)
        {
            user.rewardDebtForMooni = user.amount.mul(pool.accumulatedMooni);
        }else{
            user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        }

        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MooniFarmer.
    function withdraw(uint256 _pid, uint256 _amount) public {

        require (_pid != 0, 'withdraw asterisk by unstaking');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);

        if(pool.isMooniBnb && isMooniRewardPossible)
        {
            safeMooniTransfer(msg.sender, pool.accumulatedMooni.mul(user.amount).sub(user.rewardDebtForMooni));
        }
        else{
            if(pending > 0) {
                safeAsteriskTransfer(msg.sender, pending);
            }
        }

        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        if(pool.isMooniBnb && isMooniRewardPossible)
        {
            user.rewardDebtForMooni = user.amount.mul(pool.accumulatedMooni);
        }else{
            user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        }
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Stake asterisk tokens to MooniFarmer
    function enterStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        updatePool(0);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                safeAsteriskTransfer(msg.sender, pending);
            }
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        gov.mint(msg.sender, _amount);
        emit Deposit(msg.sender, 0, _amount);
    }

    // Withdraw asterisk tokens from STAKING.
    function leaveStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {
            safeAsteriskTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        gov.burn(msg.sender, _amount);
        emit Withdraw(msg.sender, 0, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe mooni transfer function, just in case if rounding error causes pool to not have enough moonis.
    function safeMooniTransfer(address _to, uint256 _amount) internal {
        gov.safeMooniTransfer(_to, _amount);
    }

    function safeAsteriskTransfer(address _to, uint256 _amount) internal {
        gov.safeAsteriskTransfer(_to, _amount);
    }
    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }
}
