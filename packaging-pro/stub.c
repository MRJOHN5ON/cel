/*
 * Cel Pro launcher — uses system Python + user venv (no bundled framework).
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

static void log_message(const char *msg) {
    const char *home = getenv("HOME");
    char logdir[PATH_MAX];
    char logpath[PATH_MAX];

    if (!home) {
        home = "/tmp";
    }

    snprintf(logdir, sizeof(logdir), "%s/Library/Logs/Cel Pro", home);
    ensure_dir(logdir);
    snprintf(logpath, sizeof(logpath), "%s/cel-pro.log", logdir);

    FILE *log = fopen(logpath, "a");
    if (log) {
        fprintf(log, "%s\n", msg);
        fclose(log);
    }
}

static void show_alert(const char *message) {
    char cmd[PATH_MAX * 4];
    snprintf(
        cmd,
        sizeof(cmd),
        "osascript -e 'display alert \"Cel Pro\" message \"%s\" as warning'",
        message
    );
    system(cmd);
}

static int path_executable(const char *path) {
    return path && path[0] && access(path, X_OK) == 0;
}

static int find_venv_python(const char *home, char *out, size_t outlen) {
    snprintf(
        out,
        outlen,
        "%s/Library/Application Support/Cel Pro/venv/bin/python3",
        home
    );
    return path_executable(out);
}

int main(int argc, char *argv[]) {
    char app_bundle[PATH_MAX];
    char resources[PATH_MAX];
    char python[PATH_MAX];
    char launcher[PATH_MAX];
    char logdir[PATH_MAX];
    char logpath[PATH_MAX];
    char setup[PATH_MAX];
    const char *home;

    (void)argc;
    (void)argv;

    if (bundle_app_path(app_bundle, sizeof(app_bundle)) != 0) {
        log_message("could not resolve app bundle path");
        return 1;
    }

    if (bundle_resources(resources, sizeof(resources)) != 0) {
        log_message("could not resolve Resources path");
        return 1;
    }

    home = getenv("HOME");
    if (!home) {
        home = "/tmp";
    }

    snprintf(launcher, sizeof(launcher), "%s/launcher.py", resources);
    if (access(launcher, R_OK) != 0) {
        log_message("launcher.py missing in app bundle");
        show_alert("Cel Pro is missing launcher files. Re-download or rebuild the app.");
        return 1;
    }

    if (!find_venv_python(home, python, sizeof(python))) {
        snprintf(setup, sizeof(setup), "%s/setup_deps.sh", resources);
        if (access(setup, X_OK) == 0) {
            log_message("venv missing — running setup_deps.sh");
            if (system(setup) != 0) {
                log_message("setup_deps.sh failed");
                show_alert(
                    "Cel Pro needs a one-time setup.\\n\\n"
                    "Install Python 3.10+ from python.org, then run:\\n"
                    "Install Cel Pro.command\\n\\n"
                    "See the README on GitHub for details."
                );
                return 1;
            }
        }

        if (!find_venv_python(home, python, sizeof(python))) {
            log_message("python venv still missing after setup");
            show_alert(
                "Python 3.10+ is required.\\n\\n"
                "1. Install from python.org\\n"
                "2. Run Install Cel Pro.command once\\n"
                "3. Open Cel Pro again"
            );
            return 1;
        }
    }

    setenv("PYTHONUNBUFFERED", "1", 1);
    setenv("CEL_APP_BUNDLE", app_bundle, 1);

    snprintf(logdir, sizeof(logdir), "%s/Library/Logs/Cel Pro", home);
    ensure_dir(logdir);
    snprintf(logpath, sizeof(logpath), "%s/cel-pro.log", logdir);

    freopen(logpath, "a", stdout);
    freopen(logpath, "a", stderr);

    execl(python, "Cel Pro", launcher, (char *)NULL);
    perror("Cel Pro failed to start");
    log_message("execl failed");
    return 1;
}
