import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MediaVault component failure', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="state state--error"><div><h1>MediaVault could not display this view.</h1><p>Reload the view to recover.</p><button onClick={() => location.reload()}>Reload</button></div></main>;
  }
}
