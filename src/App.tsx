/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PhotoEditor from './components/PhotoEditor';
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-black">
        <PhotoEditor />
      </div>
    </TooltipProvider>
  );
}
