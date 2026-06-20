/*
 * Native Cel launcher — runs bundled Python UI without Terminal.
 */
#include <mach-o/dyld.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static int ensure_dir(const char *path) {
    struct stat st;
    if (stat(path, &st) == 0) {
        return S_ISDIR(st.st_mode) ? 0 : -1;
    }
    return mkdir(path, 0755);
}

static int bundle_app_path(char *out, size_t outlen) {
    char exe[PATH_MAX];
    uint32_t size = sizeof(exe);

    if (_NSGetExecutablePath(exe, &size) != 0) {
        return -1;
    }

    char *marker = strstr(exe, "/Contents/MacOS");
    if (!marker) {
        return -1;
    }

    *marker = '\0';
    snprintf(out, outlen, "%s", exe);
    return 0;
}

static int bundle_resources(char *out, size_t outlen) {
    char app[PATH_MAX];
    if (bundle_app_path(app, sizeof(app)) != 0) {
        return -1;
    }
    snprintf(out, outlen, "%s/Contents/Resources", app);
    return 0;
}

static void log_start_failure(const char *msg) {
    const char *home = getenv("HOME");
    char logdir[PATH_MAX];
    char logpath[PATH_MAX];

    if (!home) {
        home = "/tmp";
    }

    snprintf(logdir, sizeof(logdir), "%s/Library/Logs/Cel", home);
    ensure_dir(logdir);
    snprintf(logpath, sizeof(logpath), "%s/cel.log", logdir);

    FILE *log = fopen(logpath, "a");
    if (log) {
        fprintf(log, "Cel failed to start: %s\n", msg);
        fclose(log);
    }
}

int main(int argc, char *argv[]) {
    char app_bundle[PATH_MAX];
    char resources[PATH_MAX];
    char python[PATH_MAX];
    char launcher[PATH_MAX];
    char logdir[PATH_MAX];
    char logpath[PATH_MAX];
    const char *home;

    (void)argc;
    (void)argv;

    if (bundle_app_path(app_bundle, sizeof(app_bundle)) != 0) {
        log_start_failure("could not resolve app bundle path");
        return 1;
    }

    if (bundle_resources(resources, sizeof(resources)) != 0) {
        log_start_failure("could not resolve Resources path");
        return 1;
    }

    snprintf(python, sizeof(python), "%s/venv/bin/python", resources);
    snprintf(launcher, sizeof(launcher), "%s/launcher.py", resources);

    if (access(python, X_OK) != 0) {
        log_start_failure("python runtime missing in app bundle");
        return 1;
    }
    if (access(launcher, R_OK) != 0) {
        log_start_failure("launcher.py missing in app bundle");
        return 1;
    }

    setenv("PYTHONUNBUFFERED", "1", 1);
    setenv("CEL_APP_BUNDLE", app_bundle, 1);

    home = getenv("HOME");
    if (!home) {
        home = "/tmp";
    }
    snprintf(logdir, sizeof(logdir), "%s/Library/Logs/Cel", home);
    ensure_dir(logdir);
    snprintf(logpath, sizeof(logpath), "%s/cel.log", logdir);

    freopen(logpath, "a", stdout);
    freopen(logpath, "a", stderr);

    execl(python, "Cel", launcher, (char *)NULL);
    perror("Cel failed to start");
    return 1;
}
