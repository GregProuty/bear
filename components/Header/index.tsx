import React, { useState, useEffect } from "react";
import { useTheme, Box, Snackbar, Typography } from "@mui/material";
import { useRouter } from "next/router";
import Link from "next/link";
import BrrrIcon from "../../public/brrr.svg";
import WalletButton from "./WalletButton";
import { Wrapper, Logo, Menu, LinkStyled, WrapperMobile } from "./style";
import { useAppSelector } from "../../redux/hooks";
import { isAssetsFetching } from "../../redux/assetsSelectors";
import { mainMenuList, Imenu } from "./menuData";
import MenuMobile from "./MenuMobile";
import { RefreshIcon } from "./svg";

const MenuItem = ({ item }: { item: Imenu }) => {
  const { title, link, allLinks } = item;
  const router = useRouter();
  const isSelected = allLinks?.includes(router.route);
  const style = isSelected ? { color: "white", borderBottom: "1px solid white" } : { opacity: 0.5 };

  return (
    <Link href={link}>
      <LinkStyled sx={{ ...style }}>{title}</LinkStyled>
    </Link>
  );
};

const Header = () => {
  const [open, setOpen] = useState(false);
  const isFetching = useAppSelector(isAssetsFetching);
  const theme = useTheme();
  useEffect(() => {
    if (isFetching) {
      setOpen(true);
    }
  }, [isFetching]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  return (
    <Box
      sx={{
        background: theme.custom.headerBackground,
        // mb: { xs: "1rem", sm: "2rem" },
      }}
    >
      {/* pc */}
      <div className="xsm:hidden">
        <Wrapper style={{ position: "relative" }}>
          <Logo
            onClick={() => {
              window.open("https://burrow.finance/");
            }}
            className="m-4"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M28.63 17.9395C28.9838 15.5739 27.1827 14.3022 24.72 13.4539L25.5188 10.2495L23.5683 9.76336L22.7905 12.8834C22.2777 12.7556 21.7511 12.635 21.2277 12.5156L22.0111 9.37503L20.0616 8.88892L19.2622 12.0922C18.8377 11.9956 18.4211 11.9 18.0166 11.7995L18.0188 11.7895L15.3288 11.1178L14.81 13.2011C14.81 13.2011 16.2572 13.5328 16.2266 13.5534C17.0166 13.7506 17.1594 14.2734 17.1355 14.6878L16.2255 18.3384C16.28 18.3522 16.3505 18.3722 16.4283 18.4034C16.3633 18.3872 16.2938 18.3695 16.2222 18.3522L14.9466 23.4661C14.85 23.7061 14.605 24.0661 14.0527 23.9295C14.0722 23.9578 12.635 23.5756 12.635 23.5756L11.6666 25.8084L14.205 26.4411C14.6772 26.5595 15.14 26.6834 15.5955 26.8L14.7883 30.0411L16.7366 30.5272L17.5361 27.3206C18.0683 27.465 18.585 27.5984 19.0905 27.7239L18.2938 30.9156L20.2444 31.4017L21.0516 28.1667C24.3777 28.7961 26.8788 28.5422 27.9316 25.5339C28.78 23.1117 27.8894 21.7145 26.1394 20.8034C27.4138 20.5095 28.3738 19.6711 28.63 17.9395ZM24.1733 24.1889C23.5705 26.6111 19.4922 25.3017 18.17 24.9734L19.2411 20.6795C20.5633 21.0095 24.8033 21.6628 24.1733 24.1889ZM24.7766 17.9045C24.2266 20.1078 20.8322 18.9884 19.7311 18.7139L20.7022 14.8195C21.8033 15.0939 25.3494 15.6061 24.7766 17.9045Z"
                fill="white"
              />
              <path
                opacity="0.5"
                d="M20 36.6667C29.2047 36.6667 36.6667 29.2047 36.6667 20L38.3333 21.6667L40 20C40 31.0457 31.0457 40 20 40L18.3333 38.3333L20 36.6667Z"
                fill="#FF9900"
              />
              <path
                d="M3.33333 20C3.33333 29.2047 10.7953 36.6667 20 36.6667L18.3333 38.3333L20 40C8.9543 40 7.8281e-07 31.0457 1.74846e-06 20L1.66667 18.3333L3.33333 20Z"
                fill="#FF9900"
              />
            </svg>
          </Logo>
          <Menu className="flex w-full justify-end mr-8">
            {mainMenuList.map((item) => (
              <MenuItem key={item.title} item={item} />
            ))}
          </Menu>
          <Box display="flex" justifyContent="center" alignItems="stretch" className="gap-4 mr-4">
            <WalletButton />
          </Box>
          <Snackbar
            open={open}
            autoHideDuration={2000}
            onClose={handleClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <div className="flex items-center justify-center border border-dark-300 text-sm text-white rounded-md bg-dark-100 px-4 py-3.5">
              <RefreshIcon className="mr-2.5 flex-shrink-0 animate-spin h-5 w-5" /> Refreshing
              assets data...
            </div>
          </Snackbar>
        </Wrapper>
      </div>
      {/* mobile */}
      <div className="lg:hidden p-4">
        <WrapperMobile>
          <Logo
            onClick={() => {
              window.open("https://burrow.finance/");
            }}
          >
            <BrrrIcon />
          </Logo>
          <Box className="flex items-center">
            <WalletButton />
            <MenuMobile />
          </Box>
        </WrapperMobile>
      </div>
    </Box>
  );
};

export default Header;
