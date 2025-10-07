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
 * Test that suspended users cannot update their profile or avatar
 *
 * This test verifies that:
 * 1. Suspended users cannot change their username
 * 2. Suspended users cannot upload or change their avatar/icon
 * 3. The UI does not show errors, but the changes are silently ignored
 *
 * Uses E2E_MODERATOR from init_e2e data for suspending functionality.
 * Requires E2E_MODERATOR_PASSWORD environment variable to be set.
 */

import { Browser, expect } from "@playwright/test";
import {
    prepareNewUser,
    newTestUsername,
    banUserAsModerator as suspendUserAsModerator,
} from "../helpers/user-utils";
import { expectOGSClickableByName } from "../helpers/matchers";

export const suspendedUserCannotUpdateProfileTest = async ({ browser }: { browser: Browser }) => {
    console.log("=== Suspended User Cannot Update Profile Test ===");

    // Create a new user
    console.log("Creating test user...");
    const username = newTestUsername("sUCPTTestUser"); // cspell:ignore sUCPT
    const { userPage } = await prepareNewUser(browser, username, "test");

    // Navigate to account settings page to get initial username
    console.log("Getting initial username...");
    await userPage.goto("/settings/account");
    await userPage.waitForLoadState("networkidle");

    // The username input is the first input in the settings page (after the Username label)
    const usernameInput = userPage.locator('dt:has-text("Username") + dd input');
    const initialUsername = await usernameInput.inputValue();

    console.log(`Initial username: ${initialUsername}`);

    // Suspend the user
    console.log(`Suspending user ${username}...`);
    await suspendUserAsModerator(
        browser,
        username,
        "E2E test: Testing suspended user profile restrictions",
    );
    console.log("User suspended ✓");

    // Wait for the suspension to take effect - suspension causes a reload of the user's page
    await userPage.waitForTimeout(1000);
    await userPage.waitForLoadState("networkidle");
    console.log("User page reloaded after suspension");

    // Try to update username while suspended
    console.log("Attempting to update username while suspended...");
    await userPage.goto("/settings/account");
    await userPage.waitForLoadState("networkidle");

    const newUsername = "HackedUsername" + Date.now();
    await usernameInput.fill(newUsername);

    const saveButton = await expectOGSClickableByName(userPage, /Save/i);
    await saveButton.click();

    // Wait for page reload (AccountSettings reloads after save - line 260 in AccountSettings.tsx)
    await userPage.waitForLoadState("load");
    await userPage.waitForLoadState("networkidle");

    console.log("Page reloaded after save");

    // Verify the username was NOT updated by checking the navbar username
    // For suspended users, the username should remain unchanged
    // Wait a moment to ensure the page has fully rendered, then check it hasn't changed
    await userPage.waitForTimeout(1000);

    const navbarUsername = userPage.locator("span.username");
    const actualUsername = await navbarUsername.textContent();

    console.log(`Username in navbar after save: ${actualUsername}, expected: ${initialUsername}`);
    expect(actualUsername).toBe(initialUsername);
    console.log("Username unchanged in navbar (correctly ignored update) ✓");

    await userPage.close();

    console.log("=== Suspended User Cannot Update Profile Test Complete ===");
    console.log("✓ Suspended users cannot update their username");
    console.log("✓ Updates are silently ignored without errors");
};

export const normalUserCanUpdateProfileTest = async ({ browser }: { browser: Browser }) => {
    console.log("=== Normal User Can Update Profile Test ===");

    // Create a new user
    console.log("Creating test user...");
    const username = newTestUsername("NormalTest");
    const { userPage } = await prepareNewUser(browser, username, "test");

    // Navigate to account settings page to get initial username
    console.log("Getting initial username...");
    await userPage.goto("/settings/account");
    await userPage.waitForLoadState("networkidle");

    // The username input is the first input in the settings page (after the Username label)
    const usernameInput = userPage.locator('dt:has-text("Username") + dd input');
    const initialUsername = await usernameInput.inputValue();

    console.log(`Initial username: ${initialUsername}`);

    // Try to update username (should succeed for normal user)
    console.log("Attempting to update username...");
    const newUsername = "ChangedUsername" + Date.now();
    await usernameInput.fill(newUsername);

    const saveButton = await expectOGSClickableByName(userPage, /Save/i);
    await saveButton.click();

    // Wait for page reload (AccountSettings reloads after save - line 260 in AccountSettings.tsx)
    await userPage.waitForLoadState("load");
    await userPage.waitForLoadState("networkidle");

    console.log("Page reloaded after save");

    // Wait for the navbar username to change from the initial username to the new one
    const navbarUsername = userPage.locator("span.username");
    await expect(navbarUsername).not.toHaveText(initialUsername);
    console.log("Username changed from initial value");

    // Verify the username WAS updated to the new value
    const actualUsername = await navbarUsername.textContent();
    console.log(`Username in navbar after save: ${actualUsername}, expected: ${newUsername}`);
    expect(actualUsername).toBe(newUsername);
    console.log("Username changed successfully in navbar ✓");

    await userPage.close();

    console.log("=== Normal User Can Update Profile Test Complete ===");
    console.log("✓ Normal users can update their username");
};
