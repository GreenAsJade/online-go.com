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

import React, { lazy, Suspense, ReactNode } from "react";

const PivotTableUI = lazy(() => import("react-pivottable/PivotTableUI"));

type PivotTableProps = {
    data: any[];
    onChange: (s: any) => void;
    // Add any other props that we need from react-pivottable here.

    children?: ReactNode;
};

export const LazyReactPivotTableUI: React.FC<PivotTableProps> = (props) => {
    const { children, ...otherProps } = props;

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PivotTableUI {...otherProps}>{children}</PivotTableUI>
        </Suspense>
    );
};
