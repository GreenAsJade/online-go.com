/*
 * Copyright (C)  Online-Go.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
* Uses init_e2e data:

* - E2E_GAMES_SIMUL_CM : user who will check the report
*/

import { Browser, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

import {
    loginAsUser,
    newTestUsername,
    prepareNewUser,
    reportUser,
    setupSeededCM,
} from "@helpers/user-utils";
import {
    acceptDirectChallenge,
    createDirectChallenge,
    defaultChallengeSettings,
} from "@helpers/challenge-utils";

import { playMoves, resignActiveGame } from "@helpers/game-utils";
import { withReportCountTracking } from "@helpers/report-utils";

export const detectContainedSimulTest = async (
    { browser }: { browser: Browser },
    testInfo: TestInfo,
) => {
    // The user who plays simultaneous games
    const challengerUsername = newTestUsername("gamesSimulCh"); // cspell:disable-line
    const { userPage: challengerContainingGamePage } = await prepareNewUser(
        browser,
        challengerUsername,
        "test",
    );

    const acceptor1Username = newTestUsername("gamesSmlAc1"); // cspell:disable-line
    const { userPage: acceptor1Page } = await prepareNewUser(browser, acceptor1Username, "test");

    // Challenger challenges the first acceptor
    await createDirectChallenge(challengerContainingGamePage, acceptor1Username, {
        ...defaultChallengeSettings,
        gameName: "E2E Games Simul Containing Test Game",
        boardSize: "9x9",
        speed: "live",
        timeControl: "byoyomi",
        mainTime: "45", // heaps of time to get organised with the other one :)
        timePerPeriod: "10",
        periods: "1",
    });

    // escaper accepts
    await acceptDirectChallenge(acceptor1Page);

    // Challenger is black
    // Wait for the Goban to be visible & definitely ready
    const goban = challengerContainingGamePage.locator(".Goban[data-pointers-bound]");
    await goban.waitFor({ state: "visible" });

    await challengerContainingGamePage.waitForTimeout(1000);

    // Wait for the game state to indicate it's the challenger's move
    const challengersMove = challengerContainingGamePage.getByText("Your move", { exact: true });
    await expect(challengersMove).toBeVisible();

    // Now a new tab for the challenger!  (2 tabs for a person in PW!)
    // Log in as the challenger

    const userContext = await browser.newContext();
    const challengerContainedGamePage = await userContext.newPage();

    await loginAsUser(challengerContainedGamePage, challengerUsername, "test");

    const acceptor2Username = newTestUsername("gamesSmlAc2"); // cspell:disable-line
    const { userPage: acceptor2Page } = await prepareNewUser(browser, acceptor2Username, "test");

    // Challenger challenges the second acceptor
    await createDirectChallenge(challengerContainedGamePage, acceptor2Username, {
        ...defaultChallengeSettings,
        gameName: `E2E Games Simul Contained Test Game`,
        boardSize: "9x9",
        speed: "live",
        timeControl: "byoyomi",
        mainTime: "45", // heaps of time to get organised with the other one :)
        timePerPeriod: "10",
        periods: "1",
    });

    // escaper accepts
    await acceptDirectChallenge(acceptor2Page);

    // Challenger is black
    // Wait for the Goban to be visible & definitely ready
    const goban2 = challengerContainedGamePage.locator(".Goban[data-pointers-bound]");
    await goban2.waitFor({ state: "visible" });

    await challengerContainedGamePage.waitForTimeout(1000);

    // Wait for the game state to indicate it's the challenger's move
    const challengersOtherMove = challengerContainedGamePage.getByText("Your move", {
        exact: true,
    });
    await expect(challengersOtherMove).toBeVisible();

    // Whoa, we have two games going at once!
    // Play a few moves to give the games an actual duration

    let moves = ["D9", "E9", "D8", "E8", "D7", "E7", "D6", "E6"];

    await playMoves(challengerContainedGamePage, acceptor2Page, moves, "9x9", 1000);

    await resignActiveGame(acceptor2Page);

    moves = ["D5", "E5", "D4", "E4", "D3", "E3"];

    await playMoves(challengerContainingGamePage, acceptor1Page, moves, "9x9", 1000);

    await resignActiveGame(acceptor1Page);

    // Use tracker to handle variable initial report count
    await withReportCountTracking(acceptor1Page, testInfo, async (reporterTracker) => {
        // Set up CM and capture their baseline BEFORE creating the report
        const cm = "E2E_GAMES_SIMUL_CM";
        const { seededCMPage: cmPage } = await setupSeededCM(browser, cm);

        // Capture CM's initial count
        const cmInitialCount = await reporterTracker["getCurrentCount"](cmPage);

        // Create a report so we can check the log for Simul detected
        await reportUser(
            acceptor1Page,
            challengerUsername,
            "ai_use",
            "reporting to see simul flag",
        );

        // Verify report was created (reporter's count increased by 1)
        const reportIndicator = await reporterTracker.assertCountIncreasedBy(acceptor1Page, 1);

        // Verify CM's count also increased by 1
        const cmCurrentCount = await reporterTracker["getCurrentCount"](cmPage);
        expect(cmCurrentCount).toBe(cmInitialCount + 1);

        // Click the CM's indicator to view the report
        const cmIndicator = cmPage.locator(".IncidentReportIndicator");
        await cmIndicator.click();

        await expect(cmPage.getByRole("heading", { name: "Reports Center" })).toBeVisible();
        await expect(cmPage.getByText("reporting to see simul flag")).toBeVisible();
        await expect(
            cmPage.locator(".simul-warning").getByText("Simul", { exact: true }),
        ).toBeVisible();

        // Clean up the report
        await reportIndicator.click();

        const cancelButton = acceptor1Page.getByText("Cancel");
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();

        // Verify count returned to initial baseline
        await reporterTracker.assertCountReturnedToInitial(acceptor1Page);
    });
};
