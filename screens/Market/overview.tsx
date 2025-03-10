import Decimal from "decimal.js";
import { createContext, useContext } from "react";
import { toInternationalCurrencySystem_usd, formatWithCommas_usd } from "../../utils/uiNumber";
import { useProtocolNetLiquidity } from "../../hooks/useNetLiquidity";
import { useRewards } from "../../hooks/useRewards";
import { isMobileDevice } from "../../helpers/helpers";
import ClippedImage from "../../components/ClippedImage/ClippedImage";

const dollarSvg = (
  <svg className="mr-1 mt-[5px]" width="18.4" height="38.4" viewBox="0 0 23 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.6914 5.05078V10.8125H10.6445V5.05078H13.6914ZM13.3203 36.9453V42.1992H10.2734V36.9453H13.3203ZM15.4688 30.5391C15.4688 29.7969 15.332 29.1654 15.0586 28.6445C14.7982 28.1237 14.3685 27.6615 13.7695 27.2578C13.1836 26.8542 12.3893 26.4635 11.3867 26.0859C9.69401 25.4349 8.20312 24.7448 6.91406 24.0156C5.63802 23.2734 4.64193 22.3555 3.92578 21.2617C3.20964 20.1549 2.85156 18.7552 2.85156 17.0625C2.85156 15.4479 3.23568 14.0482 4.00391 12.8633C4.77214 11.6784 5.83333 10.7669 7.1875 10.1289C8.55469 9.47786 10.1432 9.15234 11.9531 9.15234C13.3333 9.15234 14.5833 9.36068 15.7031 9.77734C16.8229 10.181 17.7865 10.7799 18.5938 11.5742C19.401 12.3555 20.0195 13.3125 20.4492 14.4453C20.8789 15.5781 21.0938 16.8737 21.0938 18.332H15.4883C15.4883 17.5508 15.4036 16.8607 15.2344 16.2617C15.0651 15.6628 14.8177 15.1615 14.4922 14.7578C14.1797 14.3542 13.8021 14.0547 13.3594 13.8594C12.9167 13.651 12.4284 13.5469 11.8945 13.5469C11.1003 13.5469 10.4492 13.7031 9.94141 14.0156C9.43359 14.3281 9.0625 14.7513 8.82812 15.2852C8.60677 15.806 8.49609 16.4049 8.49609 17.082C8.49609 17.7461 8.61328 18.3255 8.84766 18.8203C9.09505 19.3151 9.51823 19.7708 10.1172 20.1875C10.7161 20.5911 11.5365 21.0078 12.5781 21.4375C14.2708 22.0885 15.7552 22.7917 17.0312 23.5469C18.3073 24.3021 19.3034 25.2266 20.0195 26.3203C20.7357 27.4141 21.0938 28.8073 21.0938 30.5C21.0938 32.1797 20.7031 33.612 19.9219 34.7969C19.1406 35.9688 18.0469 36.8672 16.6406 37.4922C15.2344 38.1042 13.6068 38.4102 11.7578 38.4102C10.5599 38.4102 9.36849 38.2539 8.18359 37.9414C6.9987 37.6159 5.92448 37.0951 4.96094 36.3789C3.9974 35.6628 3.22917 34.7122 2.65625 33.5273C2.08333 32.3294 1.79688 30.8581 1.79688 29.1133H7.42188C7.42188 30.0638 7.54557 30.8581 7.79297 31.4961C8.04036 32.1211 8.36589 32.6224 8.76953 33C9.1862 33.3646 9.65495 33.625 10.1758 33.7812C10.6966 33.9375 11.224 34.0156 11.7578 34.0156C12.5911 34.0156 13.2747 33.8659 13.8086 33.5664C14.3555 33.2669 14.7656 32.8568 15.0391 32.3359C15.3255 31.8021 15.4688 31.2031 15.4688 30.5391Z" fill="#FF9900"/>
  </svg>
);

const MarketOverviewData = createContext(null) as any;
function MarketsOverview() {
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity } = useProtocolNetLiquidity();
  const { tokenNetBalanceRewards } = useRewards();
  const sumRewards = (acc, r) => acc + r.dailyAmount * r.price;
  const amount = tokenNetBalanceRewards.reduce(sumRewards, 0);
  const isMobile = isMobileDevice();
  return (
    <MarketOverviewData.Provider
      value={{
        protocolBorrowed,
        protocolDeposited,
        protocolNetLiquidity,
        amount,
      }}
    >
      {isMobile ? <MarketsOverviewMobile /> : <MarketsOverviewPc />}
    </MarketOverviewData.Provider>
  );
}

function MarketsOverviewPc() {
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity, amount } = useContext(
    MarketOverviewData,
  ) as any;
  return (
    <div className="flex items-center w-full h-[100px] rounded-xl mb-8 px-5">
      <div className="flex flex-col items-center col-span-1 z-[1]">
          <span className="text-sm text-gray-300">Available Liquidity</span>
          <span className="text-white font-bold text-[32px] flex">
            {dollarSvg}
            {toInternationalCurrencySystem_usd(protocolNetLiquidity)}
          </span>
      </div>
      <div style={{ borderLeft: "1px solid #565874", height: "80%", margin: "0 70px 0 70px" }}></div>
        <div className="flex flex-col items-start col-span-1 ">
          <span className="text-sm text-gray-300">Total Supplied</span>
          <span className="text-white font-bold  justify-center text-[32px] flex">
            {dollarSvg}
            {toInternationalCurrencySystem_usd(protocolDeposited)}
          </span>
        </div>
      <div
        style={{ borderLeft: "1px solid #565874", height: "80%", margin: "0 70px 0 70px" }}
      ></div>
        <div className="flex flex-col items-start col-span-1">
          <span className="text-sm text-gray-300">Total Borrowed</span>
          <span className="text-white justify-center font-bold text-[32px] flex">
            {dollarSvg}
            {toInternationalCurrencySystem_usd(protocolBorrowed)}
          </span>
        </div>
        <div className="absolute top-2 right-[-15vw] z-[0]">
          <ClippedImage className="w-[50vw] top-[75px]" image="svg/Nodepattern.svg" />
        </div>
    </div>
  );
}
function MarketsOverviewMobile() {
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity, amount } = useContext(
    MarketOverviewData,
  ) as any;
  return (
    <div className="w-full px-4 pb-5 border-b border-dark-950">
      <div className="text-xl font-bold text-white mb-6">Markets</div>
      <div className="grid grid-cols-2 gap-y-5">
        <TemplateMobile
          title="Total Supplied"
          value={toInternationalCurrencySystem_usd(protocolDeposited)}
        />
        <TemplateMobile
          title="Total Borrowed"
          value={toInternationalCurrencySystem_usd(protocolBorrowed)}
        />
        <TemplateMobile
          title="Available Liquidity"
          value={toInternationalCurrencySystem_usd(protocolNetLiquidity)}
        />
        <TemplateMobile title="Daily Rewards" value={formatWithCommas_usd(amount)} />
      </div>
    </div>
  );
}

function TemplateMobile({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300 text-sm mb-1 whitespace-nowrap">{title}</span>
      <span className="flex text-2xl font-bold text-white  whitespace-nowrap">{value}</span>
    </div>
  );
}
export default MarketsOverview;
