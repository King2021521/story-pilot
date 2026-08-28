import { AppProviders } from "./app/AppProviders";
import { BootErrorBoundary } from "./app/BootErrorBoundary";
import { ShellLayout } from "./app/ShellLayout";
import "./styles.css";

export function App() {
  return (
    <AppProviders>
      <BootErrorBoundary>
        <ShellLayout />
      </BootErrorBoundary>
    </AppProviders>
  );
}
