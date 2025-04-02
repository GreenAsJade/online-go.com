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

// (No seeded data in use - must not use seeded data for smoke tests!)

import { Browser, expect } from "@playwright/test";
import { goToProfile, newTestUsername, prepareNewUser } from "@helpers/user-utils";
import path from "path";

const currentDir = new URL(".", import.meta.url).pathname;

export const smokeCssSanityTest = async ({ browser }: { browser: Browser }) => {
    const { userPage } = await prepareNewUser(browser, newTestUsername("SmokeCss"), "test");

    await expect(userPage).toHaveScreenshot("initial-page.png", {
        fullPage: true,
        stylePath: path.join(currentDir, "screenshot_mask.css"),
        // Experience shows some jitter of top right icon rendering
        // I think it's due to slightly variable width of the top right username
        // container depending on the username length: could be nice to lock this.
        maxDiffPixelRatio: 0.001,
    });

    await goToProfile(userPage);

    await expect(userPage).toHaveScreenshot("profile-page.png", {
        fullPage: true,
        stylePath: path.join(currentDir, "screenshot_mask.css"),
        maxDiffPixelRatio: 0.001,
    });

    await userPage.goto("/ladders");
    await expect(userPage).toHaveScreenshot("ladders-page.png", {
        fullPage: true,
        stylePath: path.join(currentDir, "ladders_screenshot_mask.css"),
        maxDiffPixelRatio: 0.001,
    });

    await userPage.goto("/tournaments");
    await expect(userPage).toHaveScreenshot("tournaments-page.png", {
        fullPage: true,
        stylePath: path.join(currentDir, "screenshot_mask.css"),
        maxDiffPixelRatio: 0.001,
    });

    await userPage.close();
};
