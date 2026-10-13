import { FiArrowRight, FiBell, FiDownload, FiLock, FiUploadCloud } from "react-icons/fi";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/apiInstance.api";
import Badge from "../components/Badge";
import FileDropzone from "../components/FileDropzone";
import Navbar from "../components/Navbar";
import StepCard from "../components/StepCard";
import { useBookmarks, useImportBookmarks } from "../hooks/useBookmark";
import { pluralize, formatList } from "../utils/format";
import { validateBookmarkFile } from "../utils/file";

const SUPPORTED_SOURCES = ["AsuraScan", "KingOfShojo", "WeebCentral"];

const LandingPage = () => {
  const navigate = useNavigate();
  const { data: bookmarks } = useBookmarks();
  const importMutation = useImportBookmarks();
  const savedCount = bookmarks?.length ?? 0;

  const handleFile = (file: File) => {
    const problem = validateBookmarkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    importMutation.mutate(file, {
      onSuccess: ({ imported, skipped, failedScrapes }) => {
        if (imported === 0) {
          toast.error(
            `No supported series found. Only ${formatList(SUPPORTED_SOURCES)} links are imported.`,
          );
          return;
        }

        const skippedText = skipped > 0 ? `, ${skipped} skipped` : "";
        toast.success(`Imported ${imported} ${pluralize(imported, "series", "series")}${skippedText}.`);
        if (failedScrapes > 0) {
          toast.error(
            `Couldn't read the latest chapter for ${failedScrapes} ${pluralize(failedScrapes, "series", "series")}. Check them from your library.`,
          );
        }
        navigate("/home");
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar seriesCount={savedCount} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <Badge className="mx-auto" icon={<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}>
            Synced to your account
          </Badge>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Import your bookmarks. Catch every new chapter.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400">
            Export your bookmarks from Chrome, Firefox, Safari or Edge. We find the series you read, look up
            the latest chapter, and tell you when a new one is out.
          </p>
        </div>

        <div className="mt-10">
          <FileDropzone
            accept=".html,.htm,text/html"
            title="Import your bookmarks (.html export)"
            description="Drag and drop your browser's export file here, or pick it from your computer."
            busy={importMutation.isPending}
            busyTitle="Reading your bookmarks…"
            busyDescription="We're checking each series for its latest chapter. Large files can take up to two minutes."
            onFile={handleFile}
          />

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
              Supported sources
              {SUPPORTED_SOURCES.map((source) => (
                <Badge key={source}>{source}</Badge>
              ))}
            </p>
            {savedCount > 0 && (
              <Link
                to="/home"
                className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-emerald-400 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Open your library ({savedCount})
                <FiArrowRight aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          <StepCard step={1} icon={<FiDownload aria-hidden />} title="Export HTML bookmarks" hint="Takes about 10 seconds">
            In your browser, press <kbd className="rounded border border-ink-600 px-1 font-mono text-xs">Ctrl+Shift+O</kbd>{" "}
            to open the bookmark manager, then choose Export bookmarks.
          </StepCard>
          <StepCard step={2} icon={<FiUploadCloud aria-hidden />} title="Drop the file here" hint="Saved to your account">
            Add the exported file above. We keep the series from supported sites and skip everything else.
          </StepCard>
          <StepCard step={3} icon={<FiBell aria-hidden />} title="See new chapters" hint="Checked whenever you open the site">
            Each visit we look for chapters newer than the last one we saved and flag them in your library.
          </StepCard>
        </ol>
      </main>

      <footer className="border-t border-ink-700">
        <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 font-mono text-[11px] text-zinc-500 sm:px-6">
          <FiLock aria-hidden />
          Your library is tied to your account, so it follows you to any browser.
          <span className="ml-auto">Powered by Vima Devs</span>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
