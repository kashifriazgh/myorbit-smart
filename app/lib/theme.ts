// theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light', // or 'dark'
    primary: {
      main: '#1976d2', // customize as you like
    },
    secondary: {
      main: '#9c27b0',
    },
  },
  shape: {
    borderRadius: 8, // make it 0 for sharp UI
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableRipple: true, // to remove ripple effect
      },
    },
  },
});

export default theme;
