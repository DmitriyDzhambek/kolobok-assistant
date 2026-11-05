import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onGoHome: () => void;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Ошибка рендеринга вкладки:", error, errorInfo);
  }

  private handleGoHome = () => {
    this.setState({ hasError: false }, this.props.onGoHome);
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          className="stage relative flex min-h-[50vh] items-center justify-center px-4 pb-24"
          role="alert"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
            <h2 className="mb-2 text-lg font-semibold text-white">
              Ой, Колобок запутался в коде.
            </h2>
            <p className="mb-5 text-sm text-white/70">
              Попробуйте обновить страницу.
            </p>
            <button
              className="rounded-xl bg-purple-600/30 px-4 py-2 font-medium text-purple-200 transition-colors hover:bg-purple-600/50"
              onClick={this.handleGoHome}
              type="button"
            >
              На главную
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
