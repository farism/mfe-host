import React from "react";
import { Route, BrowserRouter, Link } from "react-router-dom";
import qs from "qs";

function loadComponent(scope, module) {
  return async () => {
    // Initializes the share scope. This fills it with known provided modules from this build and all remotes
    await __webpack_init_sharing__("default");

    const container = window[scope]; // or get the container somewhere else
    // Initialize the container, it may provide shared modules
    await container.init(__webpack_share_scopes__.default);

    // console.log(window[scope].get(module));
    const factory = await window[scope].get(module);
    const Module = factory();
    return Module;
  };
}

const useDynamicScript = (args) => {
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!args.url) {
      return;
    }

    const element = document.createElement("script");

    element.src = args.url;
    element.type = "text/javascript";
    element.async = true;

    setReady(false);
    setFailed(false);

    element.onload = () => {
      console.log(`Dynamic Script Loaded: ${args.url}`);
      setReady(true);
    };

    element.onerror = () => {
      console.error(`Dynamic Script Error: ${args.url}`);
      setReady(false);
      setFailed(true);
    };

    document.head.appendChild(element);

    return () => {
      console.log(`Dynamic Script Removed: ${args.url}`);
      document.head.removeChild(element);
    };
  }, [args.url]);

  return {
    ready,
    failed,
  };
};

function RemoteEntry(props) {
  const { ready, failed } = useDynamicScript({
    url: props.remote.url,
  });

  if (!props.remote) {
    return <h2>Not remote specified</h2>;
  }

  if (!ready) {
    return <h2>Loading dynamic script: {props.remote.url}</h2>;
  }

  if (failed) {
    return <h2>Failed to load dynamic script: {props.remote.url}</h2>;
  }

  const Component = React.lazy(
    loadComponent(props.remote.name, props.remote.module)
  );

  return (
    <React.Suspense fallback="Loading App">
      <Component />
    </React.Suspense>
  );
}

function useModuleRegistry() {
  const [remotes, setRemotes] = React.useState([]);

  React.useEffect(() => {
    const params = qs.parse(location.search.slice(1));

    const overrides = Object.entries(params)
      .filter(([key, _]) => key.startsWith("remote_"))
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key.replace("remote_", "")]: value,
        }),
        {}
      );

    fetch("https://mfestorage.s3.amazonaws.com/module-registry.json").then(
      async (res) => {
        if (res.status === 200) {
          const registry = (await res.json()).map((entry) => {
            const url = overrides[entry.name]
              ? entry.url.replace("master", overrides[entry.name])
              : entry.url;

            return {
              ...entry,
              url,
            };
          });

          setRemotes(registry);
        }
      }
    );
  }, []);

  console.log({ remotes });

  return remotes;
}

function App() {
  const remotes = useModuleRegistry();

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      }}
    >
      <h1>Dynamic System Host</h1>
      <h2>App 1</h2>
      <p>
        The Dynamic System will take advantage Module Federation{" "}
        <strong>remotes</strong> and <strong>exposes</strong>. It will no load
        components that have been loaded already.
      </p>
      <BrowserRouter>
        <Link to={{ pathname: "/webclient/app2", search: location.search }}>
          App 2
        </Link>
        <Link to={{ pathname: "/webclient/app3", search: location.search }}>
          App 3
        </Link>
        {remotes.map((remote) => {
          return remote.paths.map((p) => {
            return (
              <Route key={p} path={`/${p}`}>
                <RemoteEntry key={remote.name} remote={remote} />
              </Route>
            );
          });
        })}
      </BrowserRouter>
    </div>
  );
}

export default App;
