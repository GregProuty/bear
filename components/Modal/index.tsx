import { useEffect, useState, createContext } from "react";
import { Modal as MUIModal, Typography, Box, Stack, useTheme } from "@mui/material";
import Decimal from "decimal.js";
import { useAppSelector, useAppDispatch } from "../../redux/hooks";
import { hideModal, fetchConfig, updateAmount, updatePosition } from "../../redux/appSlice";
import { getModalStatus, getAssetData, getSelectedValues } from "../../redux/appSelectors";
import { getWithdrawMaxAmount } from "../../redux/selectors/getWithdrawMaxAmount";
import { getRepayPositions } from "../../redux/selectors/getRepayPositions";
import { getAccountId } from "../../redux/accountSelectors";
import { getBorrowMaxAmount } from "../../redux/selectors/getBorrowMaxAmount";
import { recomputeHealthFactor } from "../../redux/selectors/recomputeHealthFactor";
import { recomputeHealthFactorAdjust } from "../../redux/selectors/recomputeHealthFactorAdjust";
import { recomputeHealthFactorWithdraw } from "../../redux/selectors/recomputeHealthFactorWithdraw";
import { recomputeHealthFactorSupply } from "../../redux/selectors/recomputeHealthFactorSupply";
import { recomputeHealthFactorRepay } from "../../redux/selectors/recomputeHealthFactorRepay";
import { recomputeHealthFactorRepayFromDeposits } from "../../redux/selectors/recomputeHealthFactorRepayFromDeposits";
import { formatWithCommas_number } from "../../utils/uiNumber";
import { DEFAULT_POSITION, lpTokenPrefix, NBTCTokenId } from "../../utils/config";
import { Wrapper } from "./style";
import { getModalData } from "./utils";
import {
  NotConnected,
  ModalTitle,
  RepayTab,
  HealthFactor,
  Rates,
  Alerts,
  CollateralSwitch,
  CollateralTip,
  BorrowLimit,
  Receive,
} from "./components";
import Controls from "./Controls";
import Action from "./Action";
import { fetchAssets, fetchRefPrices } from "../../redux/assetsSlice";
import { useDegenMode, usePortfolioAssets } from "../../hooks/hooks";
import { useBtcAction } from "../../hooks/useBtcBalance";
import {
  CollateralTypeSelectorBorrow,
  CollateralTypeSelectorRepay,
} from "./CollateralTypeSelector";
// import Supply from "../../public/svg/Supply.svg";

export const ModalContext = createContext(null) as any;
const Modal = () => {
  const isOpen = useAppSelector(getModalStatus);
  const accountId = useAppSelector(getAccountId);
  const asset = useAppSelector(getAssetData);
  const { amount } = useAppSelector(getSelectedValues);
  const assets = useAppSelector((state) => state.assets?.data || {});
  const dispatch = useAppDispatch();
  const { isRepayFromDeposits } = useDegenMode();
  const theme = useTheme();
  const [selectedCollateralType, setSelectedCollateralType] = useState(DEFAULT_POSITION);
  const { action = "Deposit", tokenId, position } = asset;
  const { healthFactor, maxBorrowValue: adjustedMaxBorrowValue } = useAppSelector(
    action === "Withdraw"
      ? recomputeHealthFactorWithdraw(tokenId, +amount)
      : action === "Adjust"
      ? recomputeHealthFactorAdjust(tokenId, +amount)
      : action === "Supply"
      ? recomputeHealthFactorSupply(tokenId, +amount)
      : action === "Repay" && isRepayFromDeposits
      ? recomputeHealthFactorRepayFromDeposits(tokenId, +amount, selectedCollateralType)
      : action === "Repay" && !isRepayFromDeposits
      ? recomputeHealthFactorRepay(tokenId, +amount, selectedCollateralType)
      : recomputeHealthFactor(tokenId, +amount, selectedCollateralType),
  );
  const { healthFactor: single_healthFactor } = useAppSelector(
    recomputeHealthFactorWithdraw(tokenId, +amount),
  );
  const maxBorrowAmountPositions = useAppSelector(getBorrowMaxAmount(tokenId));
  const maxWithdrawAmount = useAppSelector(getWithdrawMaxAmount(tokenId));
  const repayPositions = useAppSelector(getRepayPositions(tokenId));
  const { availableBalance: btcAvailableBalance, receiveAmount } = useBtcAction({
    inputAmount: amount,
    decimals: asset.decimals,
  });
  const activePosition =
    action === "Repay" || action === "Borrow"
      ? selectedCollateralType
      : tokenId?.indexOf(lpTokenPrefix) > -1
      ? tokenId
      : DEFAULT_POSITION;
  const { maxBorrowAmount = 0, maxBorrowValue = 0 } =
    maxBorrowAmountPositions[activePosition] || {};
  const repayAmount = repayPositions[selectedCollateralType];
  const {
    symbol,
    apy,
    price,
    available,
    available$,
    totalTitle,
    rates,
    alerts,
    canUseAsCollateral,
  } = getModalData({
    ...asset,
    maxBorrowAmount,
    maxWithdrawAmount,
    isRepayFromDeposits,
    healthFactor,
    amount,
    borrowed: repayAmount,
    poolAsset: assets[tokenId],
  });
  const handleClose = () => dispatch(hideModal());
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAssets()).then(() => dispatch(fetchRefPrices()));
      dispatch(fetchConfig());
    }
  }, [isOpen]);
  useEffect(() => {
    if (position) {
      setSelectedCollateralType(position);
    }
  }, [position]);
  useEffect(() => {
    dispatch(updateAmount({ isMax: false, amount: "0" }));
    dispatch(updatePosition({ position: selectedCollateralType }));
  }, [selectedCollateralType]);
  if (action === "Adjust") {
    rates.push({
      label: "Use as Collateral",
      value: formatWithCommas_number(new Decimal(amount || 0).toFixed()),
      value$: new Decimal(price * +amount).toFixed(),
    });
  }
  const repay_to_lp =
    action === "Repay" && isRepayFromDeposits && selectedCollateralType !== DEFAULT_POSITION;
  const isBtc = action === "Supply" && asset.tokenId === NBTCTokenId;
  return (
    <MUIModal open={isOpen} onClose={handleClose}>
      <Wrapper
        sx={{
          "& *::-webkit-scrollbar": {
            backgroundColor: theme.custom.scrollbarBg,
          },
        }}
        style={{
          overflowY: "auto",
        }}
      >
        <ModalContext.Provider
          value={{
            position: selectedCollateralType,
          }}
        >
          <Box
            style={{
              border: "1px solid #565874",
            }}
            sx={{ p: ["20px", "20px"] }}
            className="border-none rounded-md overflow-hidden bg-[#14161F]"
          >
            {!accountId && <NotConnected />}
            <div className="flex items-center gap-2">
              <svg className={""} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.19757 2.02049C6.68082 2.02049 7.07257 2.41224 7.07257 2.89549C7.07257 3.37874 6.68082 3.77049 6.19757 3.77049L4.97535 3.77049C5.97035 4.73955 6.84641 5.78513 7.50447 7.06425C7.65262 7.35222 7.78871 7.65003 7.91228 7.95927C8.02739 7.67776 8.15298 7.40574 8.28869 7.14196C8.96434 5.82863 9.86983 4.7615 10.8979 3.7706L9.80237 3.7706C9.31912 3.7706 8.92737 3.37885 8.92737 2.8956C8.92737 2.41235 9.31912 2.0206 9.80237 2.0206L13.2327 2.0206C13.716 2.0206 14.1077 2.41235 14.1077 2.8956L14.1077 6.32596C14.1077 6.80921 13.716 7.20096 13.2327 7.20096C12.7495 7.20096 12.3577 6.80921 12.3577 6.32596L12.3577 4.79792C11.2977 5.78842 10.4512 6.76393 9.84483 7.94254C9.21869 9.15962 8.82204 10.6464 8.77259 12.6692C8.77473 12.787 8.7758 12.9062 8.7758 13.0267C8.7758 13.0723 8.7723 13.1172 8.76555 13.161C8.73636 13.6179 8.35657 13.9794 7.89235 13.9794C7.4091 13.9794 7.01735 13.5876 7.01735 13.1044C7.01735 12.956 7.01898 12.8098 7.02221 12.6655C6.98072 10.6049 6.58207 9.0967 5.94832 7.86482C5.38194 6.76389 4.60601 5.84017 3.64221 4.9159L3.64221 6.32585C3.64221 6.8091 3.25046 7.20085 2.76721 7.20085C2.28396 7.20085 1.89221 6.8091 1.89221 6.32585L1.89221 2.89549C1.89221 2.41224 2.28396 2.02049 2.76721 2.02049L6.19757 2.02049Z" fill="#FF9900"/>
              </svg>
              <ModalTitle asset={asset} onClose={handleClose} />
            </div>
            {/* {action === "Borrow" ? (
              <CollateralTypeSelectorBorrow
                maxBorrowAmountPositions={maxBorrowAmountPositions}
                selectedCollateralType={selectedCollateralType}
                setSelectedCollateralType={setSelectedCollateralType}
              />
            ) : null} */}
            {action === "Repay" ? (
              <CollateralTypeSelectorRepay
                repayPositions={repayPositions}
                selectedCollateralType={selectedCollateralType}
                setSelectedCollateralType={setSelectedCollateralType}
              />
            ) : null}
            <RepayTab asset={asset} />
            <Controls
              amount={amount}
              available={isBtc ? btcAvailableBalance : available}
              action={action}
              tokenId={tokenId}
              asset={asset}
              totalAvailable={isBtc ? btcAvailableBalance : available}
              available$={available$}
            />
            <div className="flex flex-col gap-4 mt-6">
              {isBtc ? <Receive value={receiveAmount} /> : null}
              <HealthFactor value={healthFactor} />
              {repay_to_lp ? (
                <HealthFactor value={single_healthFactor} title="Health Factor(Single)" />
              ) : null}
              <Rates rates={rates} />
              <BorrowLimit from={maxBorrowValue} to={adjustedMaxBorrowValue} />
              {!canUseAsCollateral ? (
                <CollateralTip />
              ) : (
                <CollateralSwitch
                  action={action}
                  canUseAsCollateral={canUseAsCollateral}
                  tokenId={asset.tokenId}
                />
              )}
            </div>
            <Alerts data={alerts} />
            <Action
              maxBorrowAmount={maxBorrowAmount}
              healthFactor={healthFactor}
              collateralType={selectedCollateralType}
              poolAsset={assets[tokenId]}
              onClose={handleClose}
            />
          </Box>
        </ModalContext.Provider>
      </Wrapper>
    </MUIModal>
  );
};

export default Modal;
