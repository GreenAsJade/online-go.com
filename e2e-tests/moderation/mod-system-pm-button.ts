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
 * Test the System PM button functionality on the Appeal page
 *
 * This test verifies that:
 * 1. A moderator can suspend a user account
 * 2. The user can submit an appeal
 * 3. The moderator can restore the account using the "Restore Account" button
 * 4. After restoration, the "System PM" button appears instead of "Leave Suspended"/"Restore Account"
 * 5. The moderator can send a System PM using the "System PM" button
 * 6. The message is sent as a system PM to the user
 *
 * Uses E2E_MODERATOR from init_e2e data for moderator functionality.
 * Requires E2E_MODERATOR_PASSWORD environment variable to be set.
 */

import { Browser, expect } from "@playwright/test";
import {
    newTestUsername,
    prepareNewUser,
    generateUniqueTestIPv6,
    loginAsUser,
    turnOffDynamicHelp,
    goToUsersProfile,
} from "../helpers/user-utils";
import { expectOGSClickableByName } from "../helpers/matchers";

export const systemPMButtonTest = async ({ browser }: { browser: Browser }) => {
    console.log("=== System PM Button Test ===");

    // 1. Create a new user to be suspended
    const username = newTestUsername("SPMUser"); // "System" is not allowed in usernames!
    console.log(`Creating test user: ${username}`);
    const { userPage, userContext } = await prepareNewUser(browser, username, "test");
    console.log(`User created: ${username} ✓`);

    // 2. Set up seeded moderator
    console.log("Setting up moderator account...");
    const moderatorPassword = process.env.E2E_MODERATOR_PASSWORD;
    if (!moderatorPassword) {
        throw new Error("E2E_MODERATOR_PASSWORD environment variable must be set to run this test");
    }

    const uniqueIPv6 = generateUniqueTestIPv6();
    const modContext = await browser.newContext({
        extraHTTPHeaders: {
            "X-Forwarded-For": uniqueIPv6,
        },
    });
    const modPage = await modContext.newPage();

    await loginAsUser(modPage, "E2E_MODERATOR", moderatorPassword);
    await turnOffDynamicHelp(modPage);
    console.log("Moderator logged in ✓");

    // 3. Moderator suspends the user
    console.log(`Moderator suspending user: ${username}`);

    // Navigate to the user's profile using OmniSearch
    await goToUsersProfile(modPage, username);
    console.log("Navigated to user profile ✓");

    // Click on the player link to open the PlayerDetails popover
    const playerLink = modPage.locator(`a.Player:has-text("${username}")`).first();
    await expect(playerLink).toBeVisible();
    await playerLink.hover();
    await playerLink.click();
    console.log("Opened player details popover ✓");

    // Click the Suspend button in the popover
    const suspendButton = await expectOGSClickableByName(modPage, /Suspend/);
    await suspendButton.click();
    console.log("Clicked Suspend button ✓");

    // Wait for BanModal to appear
    await expect(modPage.locator(".BanModal")).toBeVisible();
    console.log("Ban modal opened ✓");

    // Fill in the public reason (first textarea in modal)
    const publicReasonTextarea = modPage.locator(".BanModal textarea").first();
    await publicReasonTextarea.fill("Test suspension for System PM e2e testing");
    await expect(publicReasonTextarea).toHaveValue("Test suspension for System PM e2e testing");
    console.log("Filled suspension reason ✓");

    // Click the Suspend button in the modal
    const confirmSuspendButton = await expectOGSClickableByName(modPage, /^Suspend$/);
    await confirmSuspendButton.click();
    console.log("Confirmed suspension ✓");

    // Wait for the modal to close as confirmation
    await expect(modPage.locator(".BanModal")).toBeHidden();
    console.log("User suspended successfully ✓");

    // Give the server a moment to process
    await modPage.waitForTimeout(500);

    // 4. User submits a simple appeal
    console.log("User submitting appeal...");
    await userPage.goto("/");
    await userPage.waitForLoadState("networkidle");

    await expect(userPage.getByText("Your account has been suspended")).toBeVisible();
    console.log("Suspension banner visible ✓");

    // Click appeal link
    const appealLink = userPage.getByRole("link", { name: /appeal here/i });
    await expect(appealLink).toBeVisible();
    await appealLink.click();
    await userPage.waitForLoadState("networkidle");

    // Submit appeal message
    const appealTextarea = userPage.locator(".input-card textarea");
    await expect(appealTextarea).toBeVisible();
    await appealTextarea.fill("I apologize and would like to return to OGS.");
    await expect(appealTextarea).toHaveValue("I apologize and would like to return to OGS.");

    const userSubmitButton = await expectOGSClickableByName(userPage, /^Submit$/);
    await userSubmitButton.click();
    console.log("Appeal submitted ✓");

    // Verify the message appears in the UI
    await expect(userPage.getByText(/I apologize and would like to return to OGS/i)).toBeVisible();
    console.log("Appeal message visible in UI ✓");

    // 5. Moderator navigates to the appeal and restores the account
    console.log("Moderator navigating to Appeals Centre...");
    await modPage.goto("/appeals-center");
    await modPage.waitForLoadState("networkidle");

    await expect(modPage.getByRole("heading", { name: /Appeals Center/i })).toBeVisible();
    console.log("Appeals Centre loaded ✓");

    // Find and click on the user's appeal
    console.log(`Looking for appeal from ${username}...`);
    const appealRow = modPage.locator(".PaginatedTable tr", { hasText: username });
    await expect(appealRow).toBeVisible();

    const stateCell = appealRow.locator("td.state").last();
    await stateCell.click();
    await modPage.waitForLoadState("networkidle");
    console.log("Appeal opened ✓");

    // 6. Verify moderator sees the appeal message
    await expect(modPage.getByText(/I apologize and would like to return to OGS/i)).toBeVisible();
    console.log("Appeal message visible to moderator ✓");

    // 7. Enter a message first to enable the buttons
    console.log("Moderator entering message to restore account...");
    const restoreTextarea = modPage.locator(".input-card textarea");
    await restoreTextarea.fill("Account restored. Welcome back!");
    await expect(restoreTextarea).toHaveValue("Account restored. Welcome back!");
    console.log("Message entered ✓");

    // 8. Verify "Leave Suspended" and "Restore Account" buttons are visible and enabled
    console.log("Verifying suspended state buttons are enabled...");
    const leaveSuspendedButton = await expectOGSClickableByName(modPage, /Leave Suspended/);
    await expect(leaveSuspendedButton).toBeVisible();
    await expect(leaveSuspendedButton).toBeEnabled();
    console.log("'Leave Suspended' button visible and enabled ✓");

    const restoreButton = await expectOGSClickableByName(modPage, /Restore Account/);
    await expect(restoreButton).toBeVisible();
    await expect(restoreButton).toBeEnabled();
    console.log("'Restore Account' button visible and enabled ✓");

    // 9. Restore the account
    console.log("Moderator restoring account...");
    await restoreButton.click();
    console.log("Restore Account button clicked ✓");

    // Wait a moment for backend to process restoration
    await modPage.waitForTimeout(1000);

    // 10. Verify the "System PM" button now appears instead of the other two buttons
    console.log("Verifying System PM button appears after restoration...");

    // Reload to ensure we have the latest state
    await modPage.reload();
    await modPage.waitForLoadState("networkidle");

    // Verify "Ban has been lifted" message is visible
    await expect(modPage.getByText(/Ban has been lifted/i)).toBeVisible();
    console.log("'Ban has been lifted' message visible ✓");

    // 11. Verify the "Leave Suspended" and "Restore Account" buttons are NOT visible
    console.log("Verifying suspended state buttons are hidden...");
    await expect(modPage.getByRole("button", { name: /Leave Suspended/i })).not.toBeVisible();
    console.log("'Leave Suspended' button hidden ✓");

    await expect(modPage.getByRole("button", { name: /Restore Account/i })).not.toBeVisible();
    console.log("'Restore Account' button hidden ✓");

    // 12. Enter a message first, then verify the "System PM" button is visible and enabled
    console.log("Moderator entering message for System PM...");
    const systemPMTextarea = modPage.locator(".input-card textarea");
    await systemPMTextarea.fill("This is a follow-up message sent via System PM.");
    await expect(systemPMTextarea).toHaveValue("This is a follow-up message sent via System PM.");
    console.log("Message entered ✓");

    // Now verify the "System PM" button is visible and enabled
    const systemPMButton = await expectOGSClickableByName(modPage, /^System PM$/);
    await expect(systemPMButton).toBeVisible();
    await expect(systemPMButton).toBeEnabled();
    console.log("'System PM' button visible and enabled ✓");

    // 13. Send a System PM using the new button
    console.log("Moderator sending System PM...");
    await systemPMButton.click();
    console.log("System PM button clicked ✓");

    // Wait for the message to be sent
    await modPage.waitForTimeout(1000);

    // 14. Verify the System PM chat was opened for the user
    console.log("Verifying System PM chat opened for user...");
    await userPage.goto("/");
    await userPage.waitForLoadState("networkidle");

    // The System PM should automatically open a private chat window for the user
    // Check if the private-chat-window component is visible
    const privateChat = userPage.locator(".private-chat-window.open");
    await expect(privateChat).toBeVisible({ timeout: 5000 });
    console.log("Private chat window opened ✓");

    // Verify the message content is visible in the chat
    await expect(
        userPage.getByText(/This is a follow-up message sent via System PM/i),
    ).toBeVisible();
    console.log("System PM message visible in chat ✓");

    // Clean up
    await userPage.close();
    await userContext.close();
    await modPage.close();
    await modContext.close();

    console.log("=== System PM Button Test Complete ===");
    console.log("✓ User suspended by moderator");
    console.log("✓ User submitted appeal");
    console.log("✓ Moderator restored account with 'Restore Account' button");
    console.log("✓ 'System PM' button appears after restoration");
    console.log("✓ 'Leave Suspended' and 'Restore Account' buttons hidden after restoration");
    console.log("✓ Moderator sent System PM using new button");
    console.log("✓ System PM functionality verified");
};
