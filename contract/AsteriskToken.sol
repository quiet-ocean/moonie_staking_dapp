// SPDX-License-Identifier: Unlicensed
pragma solidity >=0.6.6;


import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AsteriskToken is ERC20("Asterisk Token", "ATK"), Ownable {
    using SafeMath for uint256;
    //@notice overrides transfer function to meet tokenomics of Asterisk - burn rate
    uint256 public burnRateDay = 30;
    uint256 public burnRateNight = 10;

    function setBurnRate(uint256 _burnRateDay, uint256 _burnRateNight) external onlyOwner() {
        require(_burnRateDay < 1000,"Burning rate must be low than 1000" );
        require(_burnRateNight < 1000,"Burning rate must be low than 1000" );
        burnRateDay = _burnRateDay;
        burnRateNight = _burnRateNight;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        uint256 rateAmount = burnRateNight; //burn 1% 18.00-06.00 UTC time
        uint256 getHour = (block.timestamp / 60 / 60) % 24; //get hour in utc time

        if(getHour >= 6 && getHour < 18){ //burn 3% 06.00-18.00 UTC time
            rateAmount = burnRateDay;
        }

        uint256 burnAmount = amount.mul(rateAmount).div(1000); // every transfer burnt
        uint256 sendAmount = amount.sub(burnAmount); // transfer sent to recipient
        super._burn(sender, burnAmount);
        super._transfer(sender, recipient, sendAmount);
    }    

    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner (FarmContract).
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
    // burn logic
    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }

}
