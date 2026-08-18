import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any render-phase errors in its subtree so the entire React tree
 * does not go blank. In production this lets us surface the real error
 * message rather than showing a black screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so it still shows up in deployment logs
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return (
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              A render error occurred. Please report the message below:
            </p>
            <pre className="text-xs bg-background rounded p-4 border border-border overflow-auto whitespace-pre-wrap break-all">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
