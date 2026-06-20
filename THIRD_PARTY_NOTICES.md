# Third-Party Notices

Cel includes and depends on open-source software. This file lists
the major components and their licenses. See each project's repository for
full license text.

## Background removal

### rembg

- **Project:** [danielgatis/rembg](https://github.com/danielgatis/rembg)
- **Author:** Daniel Gatis
- **License:** MIT
- **Use in Cel:** Core background removal engine (Python library)

Copyright (c) 2020-present Daniel Gatis

### ISNet General (`isnet-general-use`)

- **Project:** [xuebinqin/DIS](https://github.com/xuebinqin/DIS) (IS-Net)
- **Authors:** Xuebin Qin et al.
- **License:** Apache License 2.0
- **Use in Cel:** Default segmentation model (bundled for offline use)

### U²-Net (`u2net`)

- **Project:** [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net)
- **Authors:** Xuebin Qin et al.
- **License:** Apache License 2.0
- **Use in Cel:** Optional general-purpose segmentation model

### U²-Net Human Seg (`u2net_human_seg`)

- **Project:** [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net)
- **Authors:** Xuebin Qin et al.
- **License:** Apache License 2.0
- **Use in Cel:** Optional portrait-optimized segmentation model

Model weights are distributed via the rembg project. Cel does not
use models with non-commercial restrictions (e.g. Bria RMBG).

## Backend (Python)

| Component        | License              | Project |
|------------------|----------------------|---------|
| FastAPI          | MIT                  | [tiangolo/fastapi](https://github.com/fastapi/fastapi) |
| Uvicorn          | BSD 3-Clause         | [encode/uvicorn](https://github.com/encode/uvicorn) |
| python-multipart | Apache License 2.0   | [Kludex/python-multipart](https://github.com/Kludex/python-multipart) |
| Pillow           | MIT-CMU (HPND)       | [python-pillow/Pillow](https://github.com/python-pillow/Pillow) |
| pillow-heif      | BSD 3-Clause         | [bigcat88/pillow_heif](https://github.com/bigcat88/pillow_heif) |

rembg also pulls in runtime dependencies such as ONNX Runtime. See the rembg
and ONNX Runtime repositories for their respective licenses.

## Frontend (JavaScript)

| Component  | License | Project |
|------------|---------|---------|
| React      | MIT     | [facebook/react](https://github.com/facebook/react) |
| Vite       | MIT     | [vitejs/vite](https://github.com/vitejs/vite) |
| JSZip      | MIT OR GPL-3.0 (MIT option used) | [Stuk/jszip](https://github.com/Stuk/jszip) |

## Cel

The Cel application code (UI, API wrapper, packaging) is licensed
under the MIT License. See [LICENSE](LICENSE).

## User content

Images you process with Cel remain yours. Cel does not
claim any rights to your photos or exported PNGs.

## Disclaimer

This notice is provided for attribution and transparency. It is not legal
advice. If you redistribute or sell Cel, keep this file with your
distribution and ensure you comply with each upstream license.
