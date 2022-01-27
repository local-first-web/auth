@if exist "yarn.lock" del yarn.lock

for /d /r . %%d in (node_modules) do @if exist "%%d" del /f/s/q "%%d" > nul
for /d /r . %%d in (node_modules) do @if exist "%%d" rd /s /q "%%d"

for /d /r . %%d in (dist) do @if exist "%%d" del /f/s/q "%%d" > nul
for /d /r . %%d in (dist) do @if exist "%%d" rd /s /q "%%d"

