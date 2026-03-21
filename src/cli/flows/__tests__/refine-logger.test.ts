import { describe, it, expect, vi } from "vitest";
import { createRefineLogger } from "../refine-logger";

describe("createRefineLogger", () => {
  it("should log info at info level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createRefineLogger("info");
    logger.info("test message");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should not log debug at info level", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createRefineLogger("info");
    logger.debug("test");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log everything at debug level", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createRefineLogger("debug");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should log nothing at silent level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createRefineLogger("silent");
    logger.info("test");
    logger.error("test");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log only errors at error level", () => {
    const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createRefineLogger("error");
    logger.info("skip");
    logger.error("show");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
