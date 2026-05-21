import os
import subprocess

screens = {
    "1_Main_Dashboard_Mobile": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0ui7Dm4TpRXW_nLYCikJD2_O14wpq7PbicJrQIoEZcn3lnf1yoUk8zRrUdj3QZujRnNM8k01S_1G860_tCfV4rGjcZ9C3Iq6PpSkZMO58UcnLqYEGPNANiGXEggOJzUmzrCnniAhIYGHG84-XY4X6_qjC-3krOwUSkwrqrm1dgcOUxmLNhyYUrn7KL6hSDZNe5zn08j35FRlt0HiRUNPQbHa-qxxmo2KtskMru4g6WeKDhCMABJA8yDmrhw",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzE2NDY2MWUwNmUwODQ1NmM4ZDhjYzQ1YmYxZmZjMWQ4EgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    },
    "2_Sensor_Inventory_Vibrant_Emerald": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0ujUOlECdP_Nc1wqApl1ujV168mB3xVudhxfjudxCruJ5__HVv5BTJDOiQPkAVCCnFAz5Pur0QT5dkRez_FvkMIfFclFppMO_kv3cnHhFbfd6d8qxMXH42x1zKFCMhCSvFHYOvQFyZHsxEK-bH-7pRTY-8tIwlPmhvMN8jBDJonyrtF7llDVuPx3fWEzaljcBB2DpGagLdH2gVsSC95ga9gvEYIiPaBBLKtLGbNP1D0hJYQYPhLucUNhOr0",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzY3MThjZTNiYTI2NDQyNTI4OWNjZmZjOGQyNWQ5NjFhEgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    },
    "3_Historical_Analytics_Mobile": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0ugmKlY85p6lMAztNsrFpNRzInH7-N-wHtH3Y5-z_tCBPvElNzdn8jr_Dt4JiwF-jXBc5p4kcPT5duhskKB1_cM-eGQmPwgEjWn-s1WXSCmFfp9DBVUSwDXC_Ttc7yLnkhSDwkUU56kGqm35qq2gGCvS1JXzQMWhMZMM6SVllbrON7YEtRs7S7q_7YvMUeP9C8nqgZxOneXl17KXt4VT4-94inQWS6bMM36tM5-1nN0KOwULo5LkWMT52Ck",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzBlYmVkYTI1ZWI3ZjQ4MGVhM2E5NzkxMzBkNTFhMDg1EgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    },
    "4_Sensor_Inventory_Mobile": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0uhFERpQbX6d6r5YOO0HGuMWoFRWc3CnT6jilDeGKQAIq3LuiZrP8Damh5pEM3S9PKS-JKINVkj5v9IIupCtDDls8aOLmcPmjizrACEg_xSWQ9RCA1OicI3aCz-gpFwcPEHvEYKcHXrAcTKbKru5EtLfDxZ4jkV4wYcqIIrpPoIK6zhXAwETBeUi9UbTO-NJibLO3jKKSPyNrlP_OUI9i3fWRpfaMCLSsWdeP2giQ-pPghVJTZLXn0HaROI",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2ZjNjg0MjhlOGIzNTRiOGJiNGMwNmIxNTVmN2U1MTczEgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    },
    "5_Historical_Analytics_Vibrant_Emerald": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0ugm3jY3DJn_5uHs29el5SdPguPKhqP-2mkRLo_MboE6fBi7NgUlUbywDd5LWi8pj1wQqUgmbtYgpQZdy939nsQvDbBpCanTqcDPVz9ZCqj6u-M1_iElXEeQ2NTDgzQvI8J3rdAVvh_jbTwxBnvgpSPXOO4JTpBw9g4VwjaBteSASs6XzHOfVcewc_pqH_A5Pob9lwbHg4pDhIusp97Tn5dmuiKXgvjmNgseyWhDD26ZaNBO_Fxd6mcWS_c",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzMwMjI3Yzk2Yzc5NDRhYTQ5ZTAyMDM2YWJhNjY2MjEyEgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    },
    "6_Main_Dashboard_Vibrant_Emerald": {
        "img": "https://lh3.googleusercontent.com/aida/ADBb0uhNHiIxQHtdnVH3b-iDOyGfKiz3eYLCpg0f36wic_F-8eN-YlOlAvp8VtGgVMmmY5Ty9XhhUJrtV1X3j0A9UZU_7lZlesQe7gpWYxOQ1_FaRQRL9xogVY7yxf3_JG3paYwtPvx2PGNS7KhgfxD4ySn-ZRYdYfNsuMq_91dFoDR2aEE-3tuhq4AoB6DVqL90r9DI594HmxeJTtpFyRGQI4Gfl090XCnFiTFSkoiPnvd4R7Q5_86Y1vhX9k4",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzg5NjE5MTU1OTVhZDRjYTE5Mjc5MjUxZjRiZTE2MmNhEgsSBxD6pJ7GiwQYAZIBIwoKcHJvamVjdF9pZBIVQhM1OTU2MDQ1ODkxODcyNzMwMzU0&filename=&opi=89354086"
    }
}

out_dir = "stitch_screens"
os.makedirs(out_dir, exist_ok=True)

for name, links in screens.items():
    print(f"Downloading {name}...")
    
    img_path = os.path.join(out_dir, f"{name}.png")
    html_path = os.path.join(out_dir, f"{name}.html")
    
    # Use curl to download image
    subprocess.run(["curl.exe", "-s", "-L", "-o", img_path, links["img"]])
    
    # Use curl to download html
    subprocess.run(["curl.exe", "-s", "-L", "-o", html_path, links["html"]])

print("All downloads completed.")
