import appConfig from "@app-config";
import { appPath, appUrl, isUnder, publicUrl } from "@utils/paths.utils";

describe("paths", () => {
  it("builds paths under the app's base route", () => {
    expect(appPath("/overview")).toBe(`${appConfig.basePath}/overview`);
    expect(appPath("overview")).toBe(`${appConfig.basePath}/overview`);
    expect(appPath()).toBe(appConfig.basePath);
  });

  it("builds public URLs under the deployment's base path", () => {
    expect(publicUrl("/brand/logo-light.svg")).toBe("/brand/logo-light.svg");
  });

  it("builds an app route from the site's root", () => {
    expect(appUrl("/inventory/products/p-1")).toBe(`${appConfig.basePath}/inventory/products/p-1`);
  });

  it("knows when a path is a page or under it", () => {
    expect(isUnder("/client/management", "/client/management")).toBe(true);
    expect(isUnder("/client/management/x", "/client/management")).toBe(true);
    expect(isUnder("/client/managementx", "/client/management")).toBe(false);
  });
});
