import { Button, PasswordInput, Select, TextInput, createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "forest",
  colors: { forest: ["#edf7f0", "#d7eade", "#b1d5bf", "#87bfa0", "#64ab85", "#4b9e74", "#3d936b", "#2f805a", "#236e4b", "#145f3e"] },
  defaultRadius: "md",
  fontFamily: '"Noto Sans TC", system-ui, sans-serif',
  components: {
    Button: Button.extend({ defaultProps: { mih: 44 } }),
    TextInput: TextInput.extend({ styles: { input: { minHeight: 44 } } }),
    PasswordInput: PasswordInput.extend({ styles: { input: { minHeight: 44 } } }),
    Select: Select.extend({ styles: { input: { minHeight: 44 } } }),
  },
});
