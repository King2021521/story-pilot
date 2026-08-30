import { Component, type ErrorInfo, type ReactNode } from "react";

interface BootErrorBoundaryProps {
  readonly children: ReactNode;
}

interface BootErrorBoundaryState {
  readonly error?: Error;
}

export class BootErrorBoundary extends Component<BootErrorBoundaryProps, BootErrorBoundaryState> {
  override state: BootErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): BootErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Story Pilot render failed", error, errorInfo);
  }

  override render() {
    if (this.state.error) {
      return (
        <main className="boot-error" role="alert">
          <h1>Story Pilot 页面渲染失败</h1>
          <p>{this.state.error.message}</p>
          <p>请关闭应用后重新打开；如果仍然出现，请导出诊断包定位本地数据。</p>
        </main>
      );
    }

    return this.props.children;
  }
}
