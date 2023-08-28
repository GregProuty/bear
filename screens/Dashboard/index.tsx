import styled from "styled-components";
import { useEffect } from "react";
import BookTokenSvg from "../../public/svg/Group 74.svg";
import { ContentBox } from "../../components/ContentBox/ContentBox";
import LayoutContainer from "../../components/LayoutContainer/LayoutContainer";
import SupplyTokenSvg from "../../public/svg/Group 24791.svg";
import { useAccountId, useAvailableAssets, usePortfolioAssets } from "../../hooks/hooks";
import DashboardReward from "./dashboardReward";
import DashboardApy from "./dashboardApy";
import CustomTable from "../../components/CustomTable/CustomTable";
import {
  formatDustValue,
  formatTokenValue,
  formatUSDValue,
  millifyNumber,
} from "../../helpers/helpers";
import assets from "../../components/Assets";
import DashboardOverview from "./dashboardOverview";
import CustomButton from "../../components/CustomButton/CustomButton";
import DataSource from "../../data/datasource";
import {
  useWithdrawTrigger,
  useAdjustTrigger,
  useRepayTrigger,
} from "../../components/Modal/components";
import { ConnectWalletButton } from "../../components/Header/WalletButton";

const Index = () => {
  const accountId = useAccountId();
  const [suppliedRows, borrowedRows] = usePortfolioAssets();
  // const rows = useAvailableAssets();

  useEffect(() => {
    fetchData().then();
  }, []);

  const fetchData = async () => {
    try {
      const response = await DataSource.shared.getLiquidations(accountId);
    } catch (e) {
      // console.log("fetchData err",e)
    }
  };

  let overviewNode;
  if (accountId) {
    overviewNode = (
      <ContentBox className="mb-8">
        <DashboardOverview suppliedRows={suppliedRows} borrowedRows={borrowedRows} />
      </ContentBox>
    );
  } else {
    overviewNode = (
      <div className="flex justify-between items-center">
        <div>
          <div className="h3 mb-2">Connect your wallet</div>
          <div className="mb-4 text-gray-300 h4">
            Please connect your wallet to see your supplies, borrowings, and open positions.
          </div>
          <div>
            <ConnectWalletButton accountId={accountId} />
          </div>
        </div>
        <div style={{ margin: "-20px 0 -40px" }}>
          <BookTokenSvg />
        </div>
      </div>
    );
  }

  return (
    <div>
      <LayoutContainer>
        {overviewNode}

        <div style={{ minHeight: 600 }}>
          <StyledSupplyBorrow className="gap-6 md:flex lg:flex mb-10">
            <YourSupplied suppliedRows={suppliedRows} accountId={accountId} />
            <YourBorrowed borrowedRows={borrowedRows} accountId={accountId} />
          </StyledSupplyBorrow>
        </div>
      </LayoutContainer>
    </div>
  );
};

const StyledSupplyBorrow = styled.div`
  > div {
    flex: 1;
  }
`;

const yourSuppliedColumns = [
  {
    header: "Assets",
    cell: ({ originalData }) => {
      return (
        <div className="flex gap-2 items-center">
          <img
            src={originalData?.icon}
            width={26}
            height={26}
            alt="token"
            className="rounded-full"
          />
          <div className="truncate">{originalData?.symbol}</div>
        </div>
      );
    },
  },
  {
    header: "APY",
    cell: ({ originalData }) => {
      return (
        <DashboardApy
          baseAPY={originalData?.apy}
          rewardList={originalData?.rewards}
          tokenId={originalData?.tokenId}
        />
      );
    },
  },
  {
    header: "Rewards",
    cell: ({ originalData }) => {
      return <DashboardReward rewardList={originalData?.rewards} price={originalData?.price} />;
    },
  },
  {
    header: "Collateral",
    cell: ({ originalData }) => {
      return (
        <>
          <div>{formatTokenValue(originalData?.collateral)}</div>
          <div className="h6 text-gray-300">
            {formatUSDValue(originalData.collateral * originalData.price)}
          </div>
        </>
      );
    },
  },
  {
    header: "Supplied",
    cell: ({ originalData }) => {
      return (
        <>
          <div>{formatTokenValue(originalData.supplied)}</div>
          <div className="h6 text-gray-300">
            {formatUSDValue(originalData.supplied * originalData.price)}
          </div>
        </>
      );
    },
  },
];
const YourSupplied = ({ suppliedRows, accountId }) => {
  return (
    <ContentBox style={{ paddingBottom: 0, overflow: "hidden" }}>
      <div className="flex items-center mb-4">
        <div className="absolute" style={{ left: 0, top: 0 }}>
          {assets.svg.suppliedBg}
        </div>
        <SupplyTokenSvg className="mr-10" />
        <div className="h3">You Supplied</div>
      </div>
      <StyledCustomTable
        data={suppliedRows}
        columns={yourSuppliedColumns}
        noDataText={!accountId ? "Your supplied assets will appear here" : ""}
        actionRow={
          <div className="flex gap-2 pb-6">
            <div className="flex-1 flex items-center justify-center border border-primary border-opacity-60 cursor-pointer rounded-md text-sm text-primary font-bold bg-primary hover:opacity-80 bg-opacity-5 py-1">
              Withdraw
            </div>
            <CustomButton className="flex-1">Adjust</CustomButton>
          </div>
        }
      />
    </ContentBox>
  );
};

const StyledCustomTable = styled(CustomTable)`
  .custom-table-tbody {
    margin: -2px -30px 0;

    .custom-table-row {
      padding-left: 30px;
      padding-right: 30px;
      cursor: pointer;

      &:last-child {
        padding-bottom: 10px;
      }
    }
  }
`;

const yourBorrowedColumns = [
  {
    header: "Assets",
    cell: ({ originalData }) => {
      return (
        <div className="flex gap-2 items-center">
          <img
            src={originalData?.icon}
            width={26}
            height={26}
            alt="token"
            className="rounded-full"
          />
          <div className="truncate">{originalData?.symbol}</div>
        </div>
      );
    },
  },
  {
    header: "APY",
    cell: ({ originalData }) => {
      return (
        <DashboardApy
          baseAPY={originalData?.borrowApy}
          rewardList={originalData?.borrowRewards}
          tokenId={originalData?.tokenId}
          isBorrow
        />
      );
    },
  },
  {
    header: "Rewards",
    cell: ({ originalData }) => {
      return (
        <>
          <DashboardReward rewardList={originalData.borrowRewards} />
          <div className="h6 text-gray-300">{originalData.price}</div>
        </>
      );
    },
  },
  {
    header: "Borrowed",
    cell: ({ originalData }) => {
      return (
        <>
          <div>{formatTokenValue(originalData?.borrowed)}</div>
          <div className="h6 text-gray-300">
            ${millifyNumber(originalData.borrowed * originalData.price)}
          </div>
        </>
      );
    },
  },
];
const YourBorrowed = ({ borrowedRows, accountId }) => {
  const handleRepayClick = () => {
    console.info("todo");
  };
  return (
    <ContentBox>
      <div className="flex items-center mb-4">
        <div className="absolute" style={{ left: 0, top: 0 }}>
          {assets.svg.borrowBg}
        </div>
        <SupplyTokenSvg className="mr-10" />
        <div className="h3">You Borrowed</div>
      </div>
      <StyledCustomTable
        data={borrowedRows}
        columns={yourBorrowedColumns}
        noDataText={!accountId ? "You borrowed assets will appear here" : ""}
        actionRow={
          <div
            role="button"
            onClick={handleRepayClick}
            className="flex items-center justify-center border border-red-50 border-opacity-60 cursor-pointer rounded-md text-sm text-red-50 font-bold bg-red-50 bg-opacity-5 hover:opacity-80 py-1"
          >
            Repay
          </div>
        }
      />
    </ContentBox>
  );
};

export default Index;
