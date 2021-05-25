import { Button, Input, Modal } from "@procore/core-react";
import qs from "qs";
import React from "react";
import styled from "styled-components";

const localStorageKey = "moduleRegistry";

const StyledRegistry = styled.div`
  min-height: 480px;
  width: 480px;

  form {
    display: flex;
    flex-direction: column;
  }

  label {
    padding-top: 12px;
  }

  .submit {
  }
`;

const StyledSearch = styled.div`
  margin-top: 12px;
`;

const StyledRegistryItem = styled.div``;

const StyledRegistryItemHeader = styled.h3`
  margin: 12px 0 0;
`;

const StyledRegistryItemBody = styled.div`
  height: 0;
  overflow: hidden;
  padding: 2px;

  &.open {
    height: auto;
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

  const [queryParamOverrides, _] = React.useState(getQueryParams());

  function updateLocal(item) {
    setLocalOverrides(setLocalStorage(item));
  }

  function resetLocal() {
    localStorage.clear(localStorageKey);
  }

  const registry = React.useMemo(() => {
    return s3Registry.map((entry) => {
      const local = localOverrides[entry.name];

      if (local) {
        return local;
      }

      const url = queryParamOverrides[entry.name]
        ? entry.url.replace("master", queryParamOverrides[entry.name])
        : entry.url;

      return {
        ...entry,
        url,
      };
    });
  }, [s3Registry, queryParamOverrides, localOverrides]);

  React.useEffect(() => {
    fetch("https://mfestorage.s3.amazonaws.com/module-registry.json").then(
      async (res) => {
        if (res.status === 200) {
          const registry = await res.json();

          setS3Registry(registry);
        }
      }
    );
  }, []);

  return { registry, updateLocal, resetLocal };
}

export function ModuleRegistry({ registry, resetLocal, updateLocal }) {
  const [search, setSearch] = React.useState("");

  const [open, setOpen] = React.useState(false);

  function toggle(name) {
    setOpen((v) => ({ ...v, [name]: !Boolean(v[name]) }));
  }

  function reset() {
    if (confirm("Are you sure you want to reset the module registry?")) {
      resetLocal();
    }
  }

  function update(e) {
    e.preventDefault();

    const item = {};

    for (const [key, value] of new FormData(e.currentTarget).entries()) {
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
              .map((r) => {
                return (
                  <StyledRegistryItem key={r.name}>
                    <StyledRegistryItemHeader onClick={() => toggle(r.name)}>
                      {r.name}
                    </StyledRegistryItemHeader>
                    <StyledRegistryItemBody
                      className={open[r.name] || (true && "open")}
                    >
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
