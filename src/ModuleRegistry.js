import ChevronDown from "@procore/core-icons/dist/icons/ChevronDown";
import ChevronRight from "@procore/core-icons/dist/icons/ChevronRight";
import { Button, Input, Modal } from "@procore/core-react";
import qs from "qs";
import React from "react";
import styled from "styled-components";

const s3Url = "https://mfestorage.s3.amazonaws.com";

const localStorageKey = "moduleRegistry";

const StyledRegistry = styled.div`
  flex: 0 0 auto;
  padding-bottom: 24px;
  width: 540px;

  form {
    display: flex;
    flex-direction: column;
  }

  label {
    padding-top: 12px;

    > input {
      margin-top: 2px;
    }
  }

  .submit {
  }
`;

const StyledSearch = styled.div`
  margin-top: 12px;
`;

const StyledRegistryItem = styled.div`
  border: 2px solid #ccc;
  margin-top: 12px;

  &.override {
    background-color: rgb(238, 252, 238);
    border-color: rgb(28, 130, 23);
  }
`;

const StyledRegistryItemHeader = styled.h3`
  margin: 0;
  display: flex;
  align-items: center;
  padding: 8px;
`;

const StyledRegistryItemBody = styled.div`
  height: 0;
  overflow: hidden;

  &.open {
    height: auto;
    padding: 8px;
  }
`;

const StyledSubmit = styled.input`
  margin-top: 12px;
  height: 32px;
`;

function getQueryParams() {
  const params = qs.parse(location.search.slice(1));

  return Object.entries(params)
    .filter(([key, _]) => key.startsWith("mfe_branch_"))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key.replace("mfe_branch_", "")]: value,
      }),
      {}
    );
}

function getLocalStorage() {
  const registry = localStorage.getItem(localStorageKey);

  if (registry) {
    return JSON.parse(registry) || {};
  }

  return {};
}

function setLocalStorage(item) {
  const registry = getLocalStorage();

  registry[item.name] = item;

  localStorage.setItem(localStorageKey, JSON.stringify(registry));

  return registry;
}

export function useModuleRegistry() {
  const [s3Registry, setS3Registry] = React.useState([]);

  const [localOverrides, setLocalOverrides] = React.useState(getLocalStorage());

  const [queryParamOverrides, setQueryParamOverrides] = React.useState([]);

  function updateLocal(item) {
    setLocalOverrides(setLocalStorage(item));
  }

  function resetLocal() {
    localStorage.clear(localStorageKey);

    setLocalOverrides({});
  }

  const registry = React.useMemo(() => {
    return s3Registry.map((entry) => {
      const queryParam = queryParamOverrides.find(
        ({ name }) => name === entry.name
      );

      if (queryParam) {
        return queryParam;
      }

      const local = localOverrides[entry.name];

      if (local) {
        return local;
      }

      return entry;
    });
  }, [s3Registry, queryParamOverrides, localOverrides]);

  const overrides = React.useMemo(() => {
    return s3Registry.map((r, i) => r !== registry[i]);
  }, [registry]);

  React.useEffect(() => {
    const params = Object.entries(getQueryParams());

    const requests = params.map(([app, branch]) =>
      fetch(`${s3Url}/apps/${app}/${branch}/manifest.json`)
    );

    Promise.all(requests)
      .then((res) => Promise.all(res.map((r) => r.json())))
      .then((res) =>
        res.map((r, i) => {
          const branch = params[i][1];

          const entry = r.files[`${r.mfe.name}.js`];

          return {
            ...r.mfe,
            url: `${s3Url}/apps/${r.mfe.name}/${branch}/${entry}`,
          };
        })
      )
      .then(setQueryParamOverrides);

    fetch(`${s3Url}/module-registry.json`).then((res) => {
      if (res.status === 200) {
        res.json().then(setS3Registry);
      }
    });
  }, []);

  return { registry, updateLocal, resetLocal, overrides };
}

export function ModuleRegistry({
  registry,
  resetLocal,
  updateLocal,
  overrides,
}) {
  const [search, setSearch] = React.useState("");

  const [open, setOpen] = React.useState(false);

  function toggle(name) {
    setOpen((v) => ({ ...v, [name]: !Boolean(v[name]) }));
  }

  function reset() {
    if (confirm("Are you sure you want to reset the module registry?")) {
      setOpen(false);

      resetLocal();
    }
  }

  function update(e) {
    e.preventDefault();

    const item = {};

    const data = new FormData(e.currentTarget).entries();

    for (const [key, value] of data) {
      item[key] = value;
    }

    item.paths = item.paths.split(",").map((v) => v.trim());

    updateLocal(item);
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Show Module Registry</button>
      <Modal open={open} onClickOverlay={() => setOpen(false)}>
        <Modal.Header onClose={() => setOpen(false)}>
          Module Registry
        </Modal.Header>
        <Modal.Body>
          <StyledRegistry>
            <Button block onClick={reset}>
              Reset Module Registry
            </Button>
            <StyledSearch>
              <Input
                placeholder="Search"
                onChange={(e) => setSearch(e.target.value)}
                value={search}
              />
            </StyledSearch>
            {registry
              .filter((r) => r.name.includes(search))
              .map((r, i) => {
                return (
                  <StyledRegistryItem
                    key={r.name}
                    className={overrides[i] && "override"}
                  >
                    <StyledRegistryItemHeader onClick={() => toggle(r.name)}>
                      {r.name}{" "}
                      {open[r.name] ? <ChevronDown /> : <ChevronRight />}
                    </StyledRegistryItemHeader>
                    <StyledRegistryItemBody className={open[r.name] && "open"}>
                      <form onSubmit={update}>
                        <label>
                          entryPoint url
                          <Input name="url" type="text" defaultValue={r.url} />
                        </label>
                        <label>
                          paths (comma delimited)
                          <Input
                            name="paths"
                            type="text"
                            defaultValue={r.paths.join(", ")}
                          />
                        </label>
                        <label>
                          exposed module
                          <Input
                            type="text"
                            name="module"
                            defaultValue={r.module}
                          />
                        </label>
                        <Input type="hidden" name="name" value={r.name} />
                        <StyledSubmit type="submit" value="update" />
                      </form>
                    </StyledRegistryItemBody>
                  </StyledRegistryItem>
                );
              })}
          </StyledRegistry>
        </Modal.Body>
      </Modal>
    </>
  );
}
