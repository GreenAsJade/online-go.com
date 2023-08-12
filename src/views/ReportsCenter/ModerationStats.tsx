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

import * as React from "react";
import { LazyReactPivotTableUI } from "LazyReactPivotTable";

import { get } from "requests";

import { PreferenceLine } from "SettingsCommon";

export function ModerationStats(): JSX.Element {
    const [data, setData] = React.useState([]);
    const [table_state, setTableState] = React.useState({
        rows: ["moderator"],
    });
    const [days, setDays] = React.useState(7);
    const [pending_fetch, setPendingFetch] = React.useState<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        // Here we re-fetch the data if the days-slider changes.
        // We take care not to re-fetch while they are sliding the timer,
        // by only fetching after 500ms from the last change.
        if (pending_fetch) {
            clearTimeout(pending_fetch);
        }
        setPendingFetch(
            setTimeout(() => {
                void get(`moderation/stats_since/${days}`).then((stats) => {
                    setData(stats);
                });
            }, 500),
        );
    }, [days]);

    return (
        <div id="ModerationStats">
            <h3>Moderation Stats</h3>
            <PreferenceLine title={"Stats for the last"}>
                <input
                    type="range"
                    onChange={(ev) => setDays(parseInt(ev.target.value))}
                    value={days}
                    min={1}
                    max={30}
                    step={1}
                />
                <span>
                    &nbsp;
                    {`${days} days`}
                </span>
            </PreferenceLine>
            <LazyReactPivotTableUI
                data={data}
                onChange={(s) => setTableState(s)}
                {...table_state}
            />
        </div>
    );
}
