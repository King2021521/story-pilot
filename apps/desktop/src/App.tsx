import { AppProviders } from "./app/AppProviders";
import { ShellLayout } from "./app/ShellLayout";
import "./styles.css";

export function App() {
  return (
    <AppProviders>
      <ShellLayout />
    </AppProviders>
  );
}
