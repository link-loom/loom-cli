/**
 * Stand-ins for SDK components in unit tests: each renders its children inside a `data-testid` element named after
 * the component and keeps the last props it received, so a test can check what the app passed to the SDK.
 *
 *   jest.mock("@veripass/react-sdk", () => jest.requireActual("@tests/support/sdk-stubs").stubs(["VeripassUserManager"]));
 */
export const lastProps = {};

export const stub = (name) =>
  function SdkStub(props) {
    lastProps[name] = props;
    return <div data-testid={name}>{props.children}</div>;
  };

export const stubs = (names, extra = {}) => ({ ...Object.fromEntries(names.map((name) => [name, stub(name)])), ...extra });
